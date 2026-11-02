import type { WebSocket } from "uWebSockets.js";
import { type ChildProcess, fork } from "child_process";
import { randomUUID } from "crypto";
import { normalizeDeathmatchFirstTo } from "../../../shared/deathmatch/rounds";
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
import { Config } from "../config";
import { ServerLogger } from "../utils/logger";
import { EventLoopDelay, ReasonCounter } from "../utils/metrics";
import {
    type FindGamePrivateBody,
    type GameData,
    type GameOccupancy,
    type GameSocketData,
    type ProcessMsg,
    ProcessMsgType,
    type ServerGameConfig,
    type WorkerStats,
} from "../utils/types";
import {
    getAbandonReason,
    SlotReservations,
    selectIdleWorkersToKill,
    type WorkerState,
} from "./gameLifecycle";
import type { GameManager } from "./gameManager";

let path: string;
if (process.env.NODE_ENV === "production") {
    path = "dist/gameProcess.js";
} else {
    path = "src/game/gameProcess.ts";
}

const SEND_DROPPED = 2;
const STOP_REQUEST_TIMEOUT = 30_000;

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
    movingZone = false;
    zoneMode: "classic" | "rapid" | "blitz" = "classic";
    disablePerks = false;
    disableLooting = false;
    showEnemiesOnMap = true;
    deathmatchFirstTo = 1;
    id = "";
    aliveCount = 0;
    startedTime = 0;
    stopped = true;
    created = false;

    stopping = false;
    stopSeq = 0;
    stopRequestedAt = 0;
    terminating = false;
    killTimer?: ReturnType<typeof setTimeout>;

    readonly socketIds = new Set<string>();
    everHadSocket = false;
    emptySince = Date.now();
    lastJoinTokenTime = 0;
    occupancy?: GameOccupancy;
    stats?: WorkerStats;
    createdAt = Date.now();

    manager: GameProcessManager;

    onCreatedCbs: Array<(_proc: typeof this, err?: Error) => void> = [];

    lastMsgTime = Date.now();

    stoppedTime = Date.now();

    avaliableSlots = 0;
    maxPlayers = 0;
    readonly slots = new SlotReservations();
    groupHash?: string;

    get state(): WorkerState {
        if (this.terminating) return "terminating";
        if (this.stopped) return "stopped";
        if (this.stopping) return "stopping";
        if (this.creating || !this.created) return "creating";
        return this.occupancy?.started ? "running" : "waiting";
    }

    get isPublic() {
        return !this.arenaPrivate && !this.groupHash;
    }

    get joinable() {
        return !this.stopped && !this.stopping && !this.terminating;
    }

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
                case ProcessMsgType.KeepAlive:
                    if (msg.stats) this.stats = msg.stats;
                    break;
                case ProcessMsgType.UpdateData: {
                    this.canJoin = msg.canJoin;
                    this.teamMode = msg.teamMode;
                    this.mapName = msg.mapName;
                    this.arenaPrivate = !!msg.arenaPrivate;
                    this.miniGame = msg.miniGame ?? DefaultPrivateLobbyMiniGame;
                    this.amongUsImpostorCount = normalizeAmongUsImpostorCount(
                        msg.amongUsImpostorCount,
                    );
                    this.disableAirstrikes = !!msg.disableAirstrikes;
                    this.movingZone = !!msg.movingZone;
                    this.zoneMode = msg.zoneMode || "classic";
                    this.disablePerks = !!msg.disablePerks;
                    this.disableLooting = !!msg.disableLooting;
                    this.showEnemiesOnMap = msg.showEnemiesOnMap !== false;
                    this.deathmatchFirstTo = normalizeDeathmatchFirstTo(
                        msg.deathmatchFirstTo,
                    );
                    if (this.id !== msg.id) {
                        this.manager.processById.delete(this.id);
                        this.id = msg.id;
                        this.manager.processById.set(this.id, this);
                    }
                    this.aliveCount = msg.aliveCount;
                    this.startedTime = msg.startedTime;
                    if (msg.occupancy) {
                        this.occupancy = msg.occupancy;
                        this.slots.ack(msg.occupancy.tokenSeq);
                        this.avaliableSlots = Math.max(
                            0,
                            this.maxPlayers -
                                msg.occupancy.reservedSlots -
                                this.slots.pendingSlots,
                        );
                    }
                    const wasStopped = this.stopped;
                    this.stopped = msg.stopped;
                    if (this.stopped && !wasStopped) {
                        this.stoppedTime = Date.now();
                        this.created = false;
                        this.stopping = false;
                        this.manager.onGameStopped(this);
                    }
                    break;
                }
                case ProcessMsgType.StopResult:
                    if (msg.seq !== this.stopSeq) break;
                    if (!msg.stopped && this.stopping) {
                        this.manager.logger.info(
                            `Game #${this.id.substring(0, 4)} refused to stop, someone joined`,
                        );
                    }
                    this.stopping = false;
                    break;
                case ProcessMsgType.SocketMsg:
                    for (let i = 0; i < msg.msgs.length; i++) {
                        const socketMsg = msg.msgs[i];
                        const socket = this.manager.sockets.get(socketMsg.socketId);

                        if (!socket) continue;
                        if (socket.getUserData().closed) continue;
                        this.manager.sendToSocket(socket, socketMsg.data);
                    }
                    break;
                case ProcessMsgType.SocketClose:
                    const socket = this.manager.sockets.get(msg.socketId);
                    if (socket && !socket.getUserData().closed) {
                        this.manager.closeSocket(
                            socket,
                            msg.logReason ?? msg.reason ?? "game_closed_socket",
                            msg.reason,
                        );
                    }
                    break;
            }
        });

        this.create(id, config);
    }

    send(msg: ProcessMsg) {
        if (this.process.killed || !this.process.channel) return;
        if (!this.process.send(msg)) {
            this.manager.ipcBacklogged++;
        }
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
        this.movingZone = !!config.movingZone;
        this.zoneMode = config.zoneMode || "classic";
        this.disablePerks = !!config.disablePerks;
        this.disableLooting = !!config.disableLooting;
        this.showEnemiesOnMap = config.showEnemiesOnMap !== false;
        this.deathmatchFirstTo = normalizeDeathmatchFirstTo(config.deathmatchFirstTo);
        this.stopped = false;
        this.stopping = false;
        this.creating = true;
        this.groupHash = config.groupHash;
        this.aliveCount = 0;
        this.startedTime = 0;
        this.canJoin = true;

        this.occupancy = undefined;
        this.everHadSocket = false;
        this.createdAt = this.emptySince = Date.now();
        this.lastJoinTokenTime = 0;
        this.slots.clear();

        const mapDef = MapDefs[this.mapName as keyof typeof MapDefs] as MapDef;
        this.maxPlayers = this.avaliableSlots = mapDef.gameMode.maxPlayers;
    }

    addJoinTokens(
        tokens: FindGamePrivateBody["playerData"],
        autoFill: boolean,
        groupHash?: string,
    ) {
        if (groupHash && !this.groupHash) {
            this.groupHash = groupHash;
        }
        const playerTokenCount = tokens.filter((token) => !token.spectator).length;
        const seq = this.slots.reserve(playerTokenCount);
        this.lastJoinTokenTime = Date.now();
        this.send({
            type: ProcessMsgType.AddJoinToken,
            autoFill,
            tokens,
            seq,
        });
        this.avaliableSlots = Math.max(0, this.avaliableSlots - playerTokenCount);
    }

    requestStop(reason: string) {
        this.stopping = true;
        this.stopRequestedAt = Date.now();
        this.send({
            type: ProcessMsgType.Stop,
            seq: ++this.stopSeq,
            reason,
        });
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
    readonly terminatingProcesses = new Set<GameProcess>();

    readonly logger = new ServerLogger("Game Process Manager");

    readonly creations = new ReasonCounter();
    readonly cleanups = new ReasonCounter();
    readonly stopRequests = new ReasonCounter();
    readonly disconnects = new ReasonCounter();
    readonly eventLoopDelay = new EventLoopDelay();
    ipcBacklogged = 0;
    backpressureDrops = 0;
    maxBufferedBytes = 0;

    constructor() {
        process.on("beforeExit", () => {
            for (const gameProc of [...this.processes]) {
                gameProc.process.kill();
            }
        });

        setInterval(() => {
            this.checkLifecycle(Date.now());
        }, 5000);

        process.once("SIGINT", () => {
            this.shutdown();
        });
        process.once("SIGTERM", () => {
            this.shutdown();
        });
    }

    checkLifecycle(now: number) {
        const cfg = Config.gameLifecycle;
        const stoppedProcs: GameProcess[] = [];

        for (const gameProc of [...this.processes]) {
            gameProc.send({
                type: ProcessMsgType.KeepAlive,
            });

            if (now - gameProc.lastMsgTime > 60000) {
                this.logger.warn(
                    `Process ${gameProc.process.pid} - #${gameProc.id.substring(0, 4)} did not send a message in more than 60 seconds, killing`,
                );
                // sigquit can dump a core of the process
                // useful for debugging infinite loops
                this.killProcess(gameProc, "unresponsive", "SIGQUIT");
                continue;
            }

            if (gameProc.stopped) {
                stoppedProcs.push(gameProc);
                continue;
            }

            if (gameProc.stopping) {
                if (now - gameProc.stopRequestedAt > STOP_REQUEST_TIMEOUT) {
                    gameProc.stopping = false;
                }
                continue;
            }

            const reason = getAbandonReason(
                {
                    state: gameProc.state,
                    isPublic: gameProc.isPublic,
                    openSockets: gameProc.socketIds.size,
                    everHadSocket: gameProc.everHadSocket,
                    emptySince: gameProc.emptySince,
                    lastJoinTokenTime: gameProc.lastJoinTokenTime,
                    occupancy: gameProc.occupancy,
                },
                now,
                cfg,
            );
            if (reason) {
                this.logger.info(
                    `Game #${gameProc.id.substring(0, 4)} (${gameProc.mapName}${gameProc.isPublic ? "" : ", private"}) looks abandoned: ${reason}, empty for ${Math.round((now - gameProc.emptySince) / 1000)}s, asking it to stop`,
                );
                this.stopRequests.inc(reason);
                gameProc.requestStop(reason);
            }
        }

        for (const { worker, reason } of selectIdleWorkersToKill(
            stoppedProcs,
            now,
            cfg,
        )) {
            this.logger.info(
                `Process ${worker.process.pid} stopped ${Math.round((now - worker.stoppedTime) / 1000)}s ago (${reason}), killing`,
            );
            this.killProcess(worker, reason);
        }
    }

    private shutdown(): void {
        const childProcesses = this.processes
            .map((gameProc) => gameProc.process)
            .filter((child) => child.exitCode === null && child.signalCode === null);

        this.logger.info(`Shutting down ${childProcesses.length} game process(es)`);
        this.commitProcessGenocide();

        if (childProcesses.length === 0) {
            process.exit(0);
        }

        let remaining = childProcesses.length;
        const onExit = () => {
            remaining--;
            if (remaining === 0) {
                process.exit(0);
            }
        };

        for (const child of childProcesses) {
            child.once("exit", onExit);
        }

        setTimeout(() => {
            process.exit(0);
        }, 6000);
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
            if (p.stopped && !p.terminating) {
                gameProc = p;
                break;
            }
        }

        const id = randomUUID();
        if (!gameProc) {
            const proc = new GameProcess(this, id, config);
            gameProc = proc;

            this.processes.push(proc);

            proc.process.on("exit", (code, signal) => {
                this.onProcessExit(proc, code, signal);
            });
            proc.process.on("close", () => {
                this.onProcessExit(proc, proc.process.exitCode, proc.process.signalCode);
            });
            this.creations.inc("new_process");
            this.logger.info("Created new process with PID", proc.process.pid);
        } else {
            this.processById.delete(gameProc.id);
            gameProc.create(id, config);
            this.creations.inc("reused_process");
        }

        this.processById.set(id, gameProc);

        return gameProc;
    }

    commitProcessGenocide() {
        for (const proc of [...this.processes]) {
            this.killProcess(proc, "shutdown");
        }
    }

    killProcess(
        gameProc: GameProcess,
        reason: string,
        signal: NodeJS.Signals = "SIGTERM",
    ): void {
        if (gameProc.terminating) return;
        gameProc.terminating = true;
        this.terminatingProcesses.add(gameProc);
        this.cleanups.inc(reason);

        for (const socketId of [...gameProc.socketIds]) {
            const socket = this.sockets.get(socketId);
            if (socket && !socket.getUserData().closed) {
                this.closeSocket(socket, "worker_terminated");
            }
        }
        gameProc.socketIds.clear();

        for (const cb of gameProc.onCreatedCbs) {
            cb(gameProc, new Error(`game process terminated: ${reason}`));
        }
        gameProc.onCreatedCbs.length = 0;

        // send SIGTERM, if still hasn't terminated after 5 seconds, send SIGKILL >:3
        gameProc.process.kill(signal);
        gameProc.killTimer = setTimeout(() => {
            gameProc.killTimer = undefined;
            if (
                gameProc.process.exitCode === null &&
                gameProc.process.signalCode === null
            ) {
                gameProc.process.kill("SIGKILL");
            }
        }, 5000);

        util.removeFrom(this.processes, gameProc);
        if (this.processById.get(gameProc.id) === gameProc) {
            this.processById.delete(gameProc.id);
        }
    }

    onProcessExit(
        gameProc: GameProcess,
        code: number | null,
        signal: NodeJS.Signals | null,
    ) {
        if (!gameProc.terminating) {
            this.logger.warn(
                `Process ${gameProc.process.pid} - #${gameProc.id.substring(0, 4)} exited unexpectedly (code ${code}, signal ${signal}, state ${gameProc.state}, sockets ${gameProc.socketIds.size})`,
            );
        }
        this.killProcess(gameProc, code ? "crashed" : "exited");

        if (gameProc.killTimer) {
            clearTimeout(gameProc.killTimer);
            gameProc.killTimer = undefined;
        }
        this.terminatingProcesses.delete(gameProc);
        gameProc.process.removeAllListeners();
    }

    onGameStopped(gameProc: GameProcess) {
        for (const socketId of [...gameProc.socketIds]) {
            const socket = this.sockets.get(socketId);
            if (socket && !socket.getUserData().closed) {
                this.closeSocket(socket, "game_ended");
            }
        }
        gameProc.socketIds.clear();
        gameProc.slots.clear();
        if (this.processById.get(gameProc.id) === gameProc) {
            this.processById.delete(gameProc.id);
        }
    }

    getById(id: string): GameData | undefined {
        const proc = this.processById.get(id);
        if (!proc?.joinable) return undefined;
        return proc;
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
                proc.joinable &&
                proc.teamMode === body.teamMode &&
                proc.mapName === body.mapName &&
                !!proc.arenaPrivate === !!body.arenaPrivate &&
                (proc.miniGame ?? DefaultPrivateLobbyMiniGame) ===
                    (body.miniGame ?? DefaultPrivateLobbyMiniGame) &&
                proc.amongUsImpostorCount ===
                    normalizeAmongUsImpostorCount(body.amongUsImpostorCount) &&
                proc.disableAirstrikes === !!body.disableAirstrikes &&
                proc.movingZone === !!body.movingZone &&
                (proc.zoneMode || "classic") === (body.zoneMode || "classic") &&
                proc.disablePerks === !!body.disablePerks &&
                proc.disableLooting === !!body.disableLooting &&
                proc.showEnemiesOnMap === (body.showEnemiesOnMap !== false) &&
                proc.deathmatchFirstTo ===
                    normalizeDeathmatchFirstTo(body.deathmatchFirstTo) &&
                (requestedGroupHash
                    ? proc.groupHash === requestedGroupHash
                    : !proc.groupHash)
            );
        });
        let forceSpectator = false;
        let playerData = body.playerData;
        let game = targetGame?.joinable
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
                groupHash: requestedGroupHash,
                miniGame: body.miniGame ?? DefaultPrivateLobbyMiniGame,
                amongUsImpostorCount: normalizeAmongUsImpostorCount(
                    body.amongUsImpostorCount,
                ),
                disableAirstrikes: !!body.disableAirstrikes,
                movingZone: !!body.movingZone,
                zoneMode: body.zoneMode || "classic",
                disablePerks: !!body.disablePerks,
                disableLooting: !!body.disableLooting,
                showEnemiesOnMap: body.showEnemiesOnMap !== false,
                deathmatchFirstTo: normalizeDeathmatchFirstTo(body.deathmatchFirstTo),
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
            game.lastJoinTokenTime = Date.now();
            return await new Promise((resolve, reject) => {
                game.onCreatedCbs.push((game, err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    game.addJoinTokens(playerData, autoFill, requestedGroupHash);
                    resolve({ gameId: game.id, forcedSpectator: forceSpectator });
                });
            });
        }

        game.addJoinTokens(playerData, autoFill, requestedGroupHash);

        return { gameId: game.id, forcedSpectator: forceSpectator };
    }

    sendToSocket(socket: WebSocket<GameSocketData>, data: ArrayBuffer | Uint8Array) {
        const res = socket.send(data, true, false);
        const buffered = socket.getBufferedAmount();
        if (buffered > this.maxBufferedBytes) this.maxBufferedBytes = buffered;
        if (res === SEND_DROPPED) {
            this.backpressureDrops++;
            this.closeSocket(socket, "backpressure_limit");
        }
    }

    closeSocket(
        socket: WebSocket<GameSocketData>,
        logReason: string,
        clientReason?: string,
    ) {
        const data = socket.getUserData();
        if (data.closed) return;
        data.closeReason = logReason;
        if (clientReason) {
            const disconnectMsg = new net.DisconnectMsg();
            disconnectMsg.reason = clientReason;
            const stream = new net.MsgStream(new ArrayBuffer(128));
            stream.serializeMsg(net.MsgType.Disconnect, disconnectMsg);
            socket.send(stream.getBuffer(), true, false);
        }
        socket.close();
    }

    onOpen(socketId: string, socket: WebSocket<GameSocketData>): void {
        const data = socket.getUserData();
        const proc = this.processById.get(data.gameId);
        if (proc === undefined || !proc.joinable) {
            this.closeSocket(socket, "game_not_found_on_open");
            return;
        }
        this.sockets.set(socketId, socket);
        proc.socketIds.add(socketId);
        proc.everHadSocket = true;
    }

    onMsg(socketId: string, msg: ArrayBuffer): void {
        const socket = this.sockets.get(socketId);
        if (!socket) return;
        const data = socket.getUserData();
        const proc = this.processById.get(data.gameId);
        if (!proc?.socketIds.has(socketId)) {
            this.closeSocket(socket, "msg_for_stale_game");
            return;
        }
        proc.handleMsg(msg, socketId, data.ip);
    }

    onClose(socketId: string) {
        const socket = this.sockets.get(socketId);
        const data = socket?.getUserData();
        this.sockets.delete(socketId);
        if (!data) return;
        this.disconnects.inc(data.closeReason ?? "client_closed");

        const proc = this.processById.get(data.gameId);
        if (!proc?.socketIds.delete(socketId)) return;
        if (proc.socketIds.size === 0) proc.emptySince = Date.now();
        proc.handleSocketClose(socketId);
    }

    getMetrics(resetWindow = true) {
        const byState: Record<string, number> = {};
        const games = this.processes.map((proc) => {
            const state = proc.state;
            byState[state] = (byState[state] ?? 0) + 1;
            const occ = proc.occupancy;
            const stats = proc.stats;
            return {
                id: proc.id.substring(0, 8),
                pid: proc.process.pid,
                state,
                map: proc.mapName,
                teamMode: proc.teamMode,
                private: !proc.isPublic,
                ageS: Math.round((Date.now() - proc.createdAt) / 1000),
                sockets: proc.socketIds.size,
                players: occ?.connectedPlayers ?? 0,
                spectators: occ?.connectedSpectators ?? 0,
                disconnectedBodies: occ?.disconnectedBodies ?? 0,
                pendingTokens: occ?.pendingJoinTokens ?? 0,
                slots: proc.avaliableSlots,
                emptyForS:
                    proc.socketIds.size === 0
                        ? Math.round((Date.now() - proc.emptySince) / 1000)
                        : 0,
                stats,
            };
        });

        const res = {
            workers: {
                total: this.processes.length,
                terminating: this.terminatingProcesses.size,
                byState,
            },
            sockets: {
                open: this.sockets.size,
                maxBufferedBytes: this.maxBufferedBytes,
                backpressureDrops: this.backpressureDrops,
            },
            ipcBacklogged: this.ipcBacklogged,
            eventLoopDelay: this.eventLoopDelay.snapshotAndReset(resetWindow),
            rssMb: Math.round(process.memoryUsage().rss / 1048576),
            counters: {
                created: this.creations.toJSON(),
                stopRequests: this.stopRequests.toJSON(),
                cleanups: this.cleanups.toJSON(),
                disconnects: this.disconnects.toJSON(),
            },
            games,
        };
        if (!resetWindow) return res;
        this.maxBufferedBytes = 0;
        this.backpressureDrops = 0;
        this.ipcBacklogged = 0;
        return res;
    }
}
