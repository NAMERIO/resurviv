import type { WebSocket } from "uWebSockets.js";
import { type ChildProcess, fork } from "child_process";
import { randomUUID } from "crypto";
import { type MapDef, MapDefs } from "../../../shared/defs/mapDefs";
import {
    type AmongUsImpostorCount,
    DefaultAmongUsImpostorCount,
    DefaultPrivateLobbyMiniGame,
    normalizeAmongUsImpostorCount,
} from "../../../shared/defs/miniGame";
import type { TeamMode } from "../../../shared/gameConfig";
import * as net from "../../../shared/net/net";
import { util } from "../../../shared/utils/util";
import { ServerLogger } from "../utils/logger";
import {
    type FindGamePrivateBody,
    type GameData,
    type GameSocketData,
    type ProcessMsg,
    ProcessMsgType,
    type ServerGameConfig,
} from "../utils/types";
import type { GameManager } from "./gameManager";

let path: string;
if (process.env.NODE_ENV === "production") {
    path = "dist/gameProcess.js";
} else {
    path = "src/game/gameProcess.ts";
}

class GameProcess implements GameData {
    process: ChildProcess;

    canJoin = true;
    creating = false;
    teamMode: TeamMode = 1;
    mapName = "";
    arenaPrivate = false;
    miniGame: ServerGameConfig["miniGame"] = DefaultPrivateLobbyMiniGame;
    amongUsImpostorCount: AmongUsImpostorCount = DefaultAmongUsImpostorCount;
    disableAirstrikes = false;
    disablePerks = false;
    id = "";
    aliveCount = 0;
    startedTime = 0;
    stopped = true;
    created = false;

    manager: GameProcessManager;

    onCreatedCbs: Array<(_proc: typeof this) => void> = [];

    lastMsgTime = Date.now();

    stoppedTime = Date.now();

    avaliableSlots = 0;
    groupHash?: string;

    constructor(manager: GameProcessManager, id: string, config: ServerGameConfig) {
        this.manager = manager;
        this.process = fork(path, [], {
            serialization: "advanced",
        });

        this.process.on("message", (msg: ProcessMsg) => {
            if (msg.type) {
                this.lastMsgTime = Date.now();
            }

            switch (msg.type) {
                case ProcessMsgType.Created:
                    this.created = true;
                    this.stopped = false;
                    this.creating = false;
                    for (const cb of this.onCreatedCbs) {
                        cb(this);
                    }
                    this.onCreatedCbs.length = 0;
                    break;
                case ProcessMsgType.UpdateData:
                    this.canJoin = msg.canJoin;
                    this.teamMode = msg.teamMode;
                    this.mapName = msg.mapName;
                    this.arenaPrivate = !!msg.arenaPrivate;
                    this.miniGame = msg.miniGame ?? DefaultPrivateLobbyMiniGame;
                    this.amongUsImpostorCount = normalizeAmongUsImpostorCount(
                        msg.amongUsImpostorCount,
                    );
                    this.disableAirstrikes = !!msg.disableAirstrikes;
                    this.disablePerks = !!msg.disablePerks;
                    if (this.id !== msg.id) {
                        this.manager.processById.delete(this.id);
                        this.id = msg.id;
                        this.manager.processById.set(this.id, this);
                    }
                    this.aliveCount = msg.aliveCount;
                    this.startedTime = msg.startedTime;
                    this.stopped = msg.stopped;
                    if (this.stopped) {
                        this.stoppedTime = Date.now();
                        this.created = false;
                    }
                    break;
                case ProcessMsgType.SocketMsg:
                    for (let i = 0; i < msg.msgs.length; i++) {
                        const socketMsg = msg.msgs[i];
                        const socket = this.manager.sockets.get(socketMsg.socketId);

                        if (!socket) continue;
                        if (socket.getUserData().closed) continue;
                        socket.send(socketMsg.data, true, false);
                    }
                    break;
                case ProcessMsgType.SocketClose:
                    const socket = this.manager.sockets.get(msg.socketId);
                    if (socket && !socket.getUserData().closed) {
                        if (msg.reason) {
                            const disconnectMsg = new net.DisconnectMsg();
                            disconnectMsg.reason = msg.reason;
                            const stream = new net.MsgStream(new ArrayBuffer(128));
                            stream.serializeMsg(net.MsgType.Disconnect, disconnectMsg);
                            socket.send(stream.getBuffer(), true, false);
                        }

                        socket.close();
                    }
                    break;
            }
        });

        this.create(id, config);
    }

    send(msg: ProcessMsg) {
        if (this.process.killed || !this.process.channel) return;
        this.process.send(msg);
    }

    create(id: string, config: ServerGameConfig) {
        this.send({
            type: ProcessMsgType.Create,
            id,
            config,
        });
        this.id = id;
        this.teamMode = config.teamMode;
        this.mapName = config.mapName;
        this.arenaPrivate = !!config.arenaPrivate;
        this.miniGame = config.miniGame ?? DefaultPrivateLobbyMiniGame;
        this.amongUsImpostorCount = normalizeAmongUsImpostorCount(
            config.amongUsImpostorCount,
        );
        this.disableAirstrikes = !!config.disableAirstrikes;
        this.disablePerks = !!config.disablePerks;
        this.stopped = false;
        this.creating = true;
        this.groupHash = undefined;

        const mapDef = MapDefs[this.mapName as keyof typeof MapDefs] as MapDef;
        this.avaliableSlots = mapDef.gameMode.maxPlayers;
    }

    addJoinTokens(
        tokens: FindGamePrivateBody["playerData"],
        autoFill: boolean,
        groupHash?: string,
    ) {
        if (groupHash && !this.groupHash) {
            this.groupHash = groupHash;
        }
        this.send({
            type: ProcessMsgType.AddJoinToken,
            autoFill,
            tokens,
        });
        const playerTokenCount = tokens.filter((token) => !token.spectator).length;
        this.avaliableSlots = Math.max(0, this.avaliableSlots - playerTokenCount);
    }

    handleMsg(data: ArrayBuffer, socketId: string, ip: string) {
        this.send({
            type: ProcessMsgType.SocketMsg,
            msgs: [
                {
                    socketId,
                    data,
                    ip,
                },
            ],
        });
    }

    handleSocketClose(socketId: string) {
        this.send({
            type: ProcessMsgType.SocketClose,
            socketId,
        });
    }
}

export class GameProcessManager implements GameManager {
    readonly sockets = new Map<string, WebSocket<GameSocketData>>();

    readonly processById = new Map<string, GameProcess>();
    readonly processes: GameProcess[] = [];

    readonly logger = new ServerLogger("Game Process Manager");

    constructor() {
        process.on("beforeExit", () => {
            for (const gameProc of this.processes) {
                gameProc.process.kill();
            }
        });

        setInterval(() => {
            for (const gameProc of this.processes) {
                gameProc.send({
                    type: ProcessMsgType.KeepAlive,
                });

                if (Date.now() - gameProc.lastMsgTime > 60000) {
                    this.logger.warn(
                        `Process ${gameProc.process.pid} - #${gameProc.id.substring(0, 4)} did not send a message in more than 60 seconds, killing`,
                    );
                    // sigquit can dump a core of the process
                    // useful for debugging infinite loops
                    this.killProcess(gameProc, "SIGQUIT");
                } else if (
                    gameProc.stopped &&
                    Date.now() - gameProc.stoppedTime > 60000
                ) {
                    this.logger.warn(
                        `Process ${gameProc.process.pid} - #${gameProc.id.substring(0, 4)} stopped more than a minute ago, killing`,
                    );
                    this.killProcess(gameProc);
                }
            }
        }, 5000);
    }

    kickPlayerByIP(encodedIp: string) {
        for (const gameProc of this.processes) {
            if (gameProc.aliveCount > 0 && !gameProc.stopped) {
                gameProc.send({
                    type: ProcessMsgType.KickPlayerByIP,
                    encodedIp,
                });
            }
        }
    }
    getPlayerCount(): number {
        return this.processes.reduce((a, b) => {
            return a + b.aliveCount;
        }, 0);
    }

    newGame(config: ServerGameConfig): GameProcess {
        let gameProc: GameProcess | undefined;

        for (let i = 0; i < this.processes.length; i++) {
            const p = this.processes[i];
            if (p.stopped) {
                gameProc = p;
                break;
            }
        }

        const id = randomUUID();
        if (!gameProc) {
            gameProc = new GameProcess(this, id, config);

            this.processes.push(gameProc);

            gameProc.process.on("exit", () => {
                this.killProcess(gameProc!);
            });
            gameProc.process.on("close", () => {
                this.killProcess(gameProc!);
            });
            gameProc.process.on("disconnect", () => {
                this.killProcess(gameProc!);
            });
            this.logger.info("Created new process with PID", gameProc.process.pid);
        } else {
            this.processById.delete(gameProc.id);
            gameProc.create(id, config);
        }

        this.processById.set(id, gameProc);

        return gameProc;
    }

    commitProcessGenocide() {
        for (const proc of this.processes) {
            this.killProcess(proc);
        }
    }

    killProcess(gameProc: GameProcess, signal: NodeJS.Signals = "SIGTERM"): void {
        for (const [, socket] of this.sockets) {
            const data = socket.getUserData();
            if (data.closed) continue;
            if (data.gameId !== gameProc.id) continue;
            this.logger.warn(`Closing socket for ${gameProc.id}`);
            socket.close();
        }

        // send SIGTERM, if still hasn't terminated after 5 seconds, send SIGKILL >:3
        gameProc.process.kill(signal);
        setTimeout(() => {
            if (!gameProc.process.killed) {
                gameProc.process.kill("SIGKILL");
            }
        }, 5000);

        util.removeFrom(this.processes, gameProc);
        this.processById.delete(gameProc.id);
    }

    getById(id: string): GameData | undefined {
        return this.processById.get(id);
    }

    async findGame(
        body: FindGamePrivateBody,
    ): Promise<{ gameId: string; forcedSpectator?: boolean }> {
        const requestedGroupHash = body.groupHash;
        const targetGame = body.targetGameId
            ? this.processById.get(body.targetGameId)
            : undefined;
        const spectatorOnly =
            !!body.arenaPrivate &&
            body.playerData.length > 0 &&
            body.playerData.every((player) => player.spectator);
        const battleRoyaleArenaLateJoin =
            !!body.arenaPrivate &&
            !!requestedGroupHash &&
            body.mapName.startsWith("br_") &&
            body.playerData.length > 0 &&
            !spectatorOnly;
        const matchingGames = this.processes.filter((proc) => {
            return (
                !proc.stopped &&
                proc.teamMode === body.teamMode &&
                proc.mapName === body.mapName &&
                !!proc.arenaPrivate === !!body.arenaPrivate &&
                (proc.miniGame ?? DefaultPrivateLobbyMiniGame) ===
                    (body.miniGame ?? DefaultPrivateLobbyMiniGame) &&
                proc.amongUsImpostorCount ===
                    normalizeAmongUsImpostorCount(body.amongUsImpostorCount) &&
                proc.disableAirstrikes === !!body.disableAirstrikes &&
                proc.disablePerks === !!body.disablePerks &&
                (requestedGroupHash
                    ? proc.groupHash === requestedGroupHash
                    : !proc.groupHash)
            );
        });
        let forceSpectator = false;
        let playerData = body.playerData;
        let game =
            targetGame && !targetGame.stopped
                ? targetGame
                : matchingGames
                      .filter((proc) => {
                          return (
                              (proc.canJoin && proc.avaliableSlots > 0) ||
                              proc.creating ||
                              spectatorOnly
                          );
                      })
                      .sort((a, b) => {
                          return a.startedTime - b.startedTime;
                      })[0];

        if (
            game &&
            targetGame === game &&
            battleRoyaleArenaLateJoin &&
            (!game.canJoin || game.avaliableSlots <= 0)
        ) {
            forceSpectator = true;
            playerData = body.playerData.map((player) => ({
                ...player,
                spectator: true,
            }));
        }

        if (!game && battleRoyaleArenaLateJoin) {
            game = matchingGames
                .filter((proc) => !proc.creating)
                .sort((a, b) => {
                    return a.startedTime - b.startedTime;
                })[0];
            if (game) {
                forceSpectator = true;
                playerData = body.playerData.map((player) => ({
                    ...player,
                    spectator: true,
                }));
            }
        }

        if (!game) {
            game = this.newGame({
                teamMode: body.teamMode,
                mapName: body.mapName as keyof typeof MapDefs,
                arenaPrivate: !!body.arenaPrivate,
                miniGame: body.miniGame ?? DefaultPrivateLobbyMiniGame,
                amongUsImpostorCount: normalizeAmongUsImpostorCount(
                    body.amongUsImpostorCount,
                ),
                disableAirstrikes: !!body.disableAirstrikes,
                disablePerks: !!body.disablePerks,
            });
        }

        // Reserve creating/idle process immediately for private-lobby hash so
        // subsequent findGame calls (eg pressing Play during warmup) reuse it.
        if (requestedGroupHash && !game.groupHash) {
            game.groupHash = requestedGroupHash;
        }

        const autoFill = game.aliveCount <= 1 ? false : body.autoFill;
        // if the game has not finished creating
        // wait for it to be created to send the find game response
        if (!game.created) {
            return await new Promise((resolve) => {
                game.onCreatedCbs.push((game) => {
                    game.addJoinTokens(playerData, autoFill, requestedGroupHash);
                    resolve({ gameId: game.id, forcedSpectator: forceSpectator });
                });
            });
        }

        game.addJoinTokens(playerData, autoFill, requestedGroupHash);

        return { gameId: game.id, forcedSpectator: forceSpectator };
    }

    onOpen(socketId: string, socket: WebSocket<GameSocketData>): void {
        const data = socket.getUserData();
        const proc = this.processById.get(data.gameId);
        if (proc === undefined) {
            this.logger.warn("prcoess not found, closing socket.");
            socket.close();
            return;
        }
        this.sockets.set(socketId, socket);
    }

    onMsg(socketId: string, msg: ArrayBuffer): void {
        const data = this.sockets.get(socketId)?.getUserData();
        if (!data) return;
        this.processById.get(data.gameId)?.handleMsg(msg, socketId, data.ip);
    }

    onClose(socketId: string) {
        const data = this.sockets.get(socketId)?.getUserData();
        this.sockets.delete(socketId);
        if (!data) return;
        this.processById.get(data.gameId)?.handleSocketClose(socketId);
    }
}
