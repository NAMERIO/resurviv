import type { ArenaTeam } from "../../../shared/defs/miniGame";
import { GameConfig } from "../../../shared/gameConfig";
import * as net from "../../../shared/net/net";
import { type Vec2, v2 } from "../../../shared/utils/v2";
import type { Game } from "./game";
import type { MapIndicator } from "./objects/mapIndicator";
import type { Obstacle } from "./objects/obstacle";
import type { Player } from "./objects/player";
import { getCaptureTheFlagSettings } from "./privateLobbyMiniGames";

type FlagStatus = "base" | "taken" | "dropped";
type FlagTeam = "A" | "B";

interface CtfFlag {
    team: FlagTeam;
    teamId: 1 | 2;
    roleType: "ctf_flag_red" | "ctf_flag_blue";
    basePos: Vec2;
    pos: Vec2;
    status: FlagStatus;
    carrier?: Player;
    droppedReturnTicker: number;
    indicator?: MapIndicator;
    object?: Obstacle;
}

export class CaptureTheFlagManager {
    readonly enabled: boolean;
    readonly settings;
    readonly flags: Record<FlagTeam, CtfFlag>;
    readonly score: Record<FlagTeam, number> = { A: 0, B: 0 };
    private lastBroadcastSecond = -1;

    constructor(readonly game: Game) {
        this.settings = getCaptureTheFlagSettings(this.game.miniGame);
        this.enabled = !!this.settings && this.game.arenaPrivate;
        const def = game.map.mapDef.gameMode.captureTheFlag;
        const redFlag =
            def?.redFlag ?? v2.create(game.map.width * 0.15, game.map.height / 2);
        const blueFlag =
            def?.blueFlag ?? v2.create(game.map.width * 0.85, game.map.height / 2);
        this.flags = {
            A: this.createFlag("A", 1, "ctf_flag_red", redFlag),
            B: this.createFlag("B", 2, "ctf_flag_blue", blueFlag),
        };
    }

    init(): void {
        if (!this.enabled) return;
        this.ensureIndicators();
        this.ensureFlagObjects();
        this.broadcast();
    }

    update(dt: number): void {
        if (!this.enabled || this.game.over || !this.game.started) return;

        this.ensureIndicators();
        for (const flag of Object.values(this.flags)) {
            if (flag.status === "taken" && flag.carrier) {
                v2.set(flag.pos, flag.carrier.pos);
                flag.indicator?.updatePosition(flag.pos);
            } else if (flag.status === "dropped") {
                flag.droppedReturnTicker -= dt;
                if (flag.droppedReturnTicker <= 0) {
                    this.returnFlag(flag, 0);
                }
            }
            this.syncFlagObject(flag);
        }

        const pickupRadius =
            this.game.map.mapDef.gameMode.captureTheFlag?.flagPickupRadius ?? 2.5;
        const captureRadius =
            this.game.map.mapDef.gameMode.captureTheFlag?.captureRadius ?? 4;
        const captureZoneSize =
            this.game.map.mapDef.gameMode.captureTheFlag?.captureZoneSize;

        for (const player of this.game.playerBarn.livingPlayers) {
            if (
                player.dead ||
                player.downed ||
                player.disconnected ||
                player.spectatorOnly
            ) {
                continue;
            }
            const team = this.getPlayerFlagTeam(player);
            if (!team) continue;
            const ownFlag = this.flags[team];
            const enemyFlag = this.flags[this.enemyTeam(team)];

            if (
                enemyFlag.status !== "taken" &&
                v2.distance(player.pos, enemyFlag.pos) <= pickupRadius
            ) {
                this.takeFlag(player, enemyFlag);
                continue;
            }

            if (
                enemyFlag.carrier === player &&
                ownFlag.status === "base" &&
                (this.isInFlagZone(player.pos, ownFlag.basePos, captureZoneSize) ||
                    v2.distance(player.pos, ownFlag.basePos) <= captureRadius)
            ) {
                this.captureFlag(player, enemyFlag);
            }
        }

        const secondsLeft = Math.ceil(this.matchTimeLeft);
        if (secondsLeft !== this.lastBroadcastSecond) {
            this.lastBroadcastSecond = secondsLeft;
            this.broadcast();
        }
        if (this.matchTimeLeft <= 0) {
            this.game.checkGameOver();
        }
    }

    onPlayerDeath(player: Player): void {
        if (!this.enabled) return;
        for (const flag of Object.values(this.flags)) {
            if (flag.carrier === player) {
                this.dropFlag(flag, player.pos, player.teamId);
            }
        }
    }

    getSpawnPos(arenaTeam: ArenaTeam | undefined): Vec2 | undefined {
        if (!this.enabled) return undefined;
        const def = this.game.map.mapDef.gameMode.captureTheFlag;
        const center =
            arenaTeam === "A"
                ? (def?.redSpawn ?? this.flags.A.basePos)
                : arenaTeam === "B"
                  ? (def?.blueSpawn ?? this.flags.B.basePos)
                  : undefined;
        if (!center) return undefined;
        const radius = this.game.map.mapDef.gameMode.captureTheFlag?.spawnRadius ?? 16;
        return v2.add(center, v2.mul(v2.randomUnit(), Math.random() * radius));
    }

    getWinningTeamId(): number {
        if (!this.enabled) return 0;
        if (this.score.A === this.score.B) return 0;
        return this.score.A > this.score.B ? 1 : 2;
    }

    hasReachedScoreLimit(): boolean {
        if (!this.enabled || !this.settings) return false;
        return (
            this.score.A >= this.settings.scoreLimit ||
            this.score.B >= this.settings.scoreLimit
        );
    }

    endWithWinner(winningTeamId: number): true {
        for (const player of this.game.playerBarn.players) {
            player.addGameOverMsg(winningTeamId, { gameOver: true });
        }
        return true;
    }

    get matchTimeLeft(): number {
        if (!this.enabled || !this.settings || !this.game.started) {
            return this.settings?.matchDuration ?? 600;
        }
        return Math.max(0, this.settings.matchDuration - this.game.startedTime);
    }

    private createFlag(
        team: FlagTeam,
        teamId: 1 | 2,
        roleType: CtfFlag["roleType"],
        basePos: Vec2,
    ): CtfFlag {
        return {
            team,
            teamId,
            roleType,
            basePos: v2.copy(basePos),
            pos: v2.copy(basePos),
            status: "base",
            droppedReturnTicker: 0,
        };
    }

    private isInFlagZone(pos: Vec2, center: Vec2, size: Vec2 | undefined): boolean {
        if (!size) return false;
        const playerRadius = GameConfig.player.radius;
        return (
            Math.abs(pos.x - center.x) <= size.x / 2 + playerRadius &&
            Math.abs(pos.y - center.y) <= size.y / 2 + playerRadius
        );
    }

    private ensureIndicators(): void {
        for (const flag of Object.values(this.flags)) {
            if (!flag.indicator) {
                flag.indicator = this.game.mapIndicatorBarn.allocIndicator(
                    flag.roleType,
                    flag.status !== "base",
                );
            }
            flag.indicator?.updatePosition(flag.pos);
            if (flag.indicator) {
                flag.indicator.equipped = flag.status !== "base";
                flag.indicator.dirty = true;
            }
        }
    }

    private ensureFlagObjects(): void {
        for (const flag of Object.values(this.flags)) {
            if (!flag.object) {
                flag.object = this.game.map.genObstacle(
                    this.getFlagObjectType(flag),
                    flag.pos,
                    0,
                    0,
                    1,
                    undefined,
                    undefined,
                    true,
                );
            }
            this.syncFlagObject(flag);
        }
    }

    private syncFlagObject(flag: CtfFlag): void {
        if (!flag.object) return;

        const object = flag.object;
        const objectType = this.getFlagObjectType(flag);
        const needsFullUpdate = object.type !== objectType;
        const needsPosUpdate = !v2.eq(object.pos, flag.pos);

        if (needsFullUpdate) {
            object.type = objectType;
            object.setDirty();
        }

        if (needsPosUpdate) {
            v2.set(object.pos, flag.pos);
            object.updateCollider();
            object.setPartDirty();
        }
    }

    private getFlagObjectType(flag: CtfFlag): string {
        if (flag.status === "taken") return "ctf_flag_hidden";
        return flag.teamId === 1 ? "ctf_flag_red" : "ctf_flag_blue";
    }

    private takeFlag(player: Player, flag: CtfFlag): void {
        flag.status = "taken";
        flag.carrier = player;
        flag.droppedReturnTicker = 0;
        player.promoteToRole(flag.roleType);
        this.syncFlagObject(flag);
        this.broadcast(
            net.CaptureTheFlagEvent.Taken,
            flag.teamId,
            player.teamId,
            player.__id,
        );
    }

    private dropFlag(flag: CtfFlag, pos: Vec2, actorTeamId: number): void {
        flag.status = "dropped";
        flag.carrier?.removeRole();
        flag.carrier = undefined;
        v2.set(flag.pos, pos);
        flag.droppedReturnTicker = this.settings?.droppedFlagReturnTime ?? 20;
        flag.indicator?.updatePosition(flag.pos);
        this.syncFlagObject(flag);
        this.broadcast(net.CaptureTheFlagEvent.Dropped, flag.teamId, actorTeamId, 0);
    }

    private returnFlag(flag: CtfFlag, actorTeamId: number, broadcast = true): void {
        flag.status = "base";
        flag.carrier?.removeRole();
        flag.carrier = undefined;
        v2.set(flag.pos, flag.basePos);
        flag.droppedReturnTicker = 0;
        flag.indicator?.updatePosition(flag.pos);
        this.syncFlagObject(flag);
        if (broadcast) {
            this.broadcast(net.CaptureTheFlagEvent.Returned, flag.teamId, actorTeamId, 0);
        }
    }

    private captureFlag(player: Player, enemyFlag: CtfFlag): void {
        const scoringTeam = this.getPlayerFlagTeam(player);
        if (!scoringTeam || !this.settings) return;
        this.score[scoringTeam] += this.settings.captureScore;
        this.returnFlag(enemyFlag, player.teamId, false);
        this.broadcast(
            net.CaptureTheFlagEvent.Captured,
            enemyFlag.teamId,
            player.teamId,
            player.__id,
        );
        this.game.playerBarn.aliveCountDirty = true;
        if (this.hasReachedScoreLimit()) {
            this.game.checkGameOver();
        }
    }

    private broadcast(
        event = net.CaptureTheFlagEvent.None,
        flagTeamId = 0,
        actorTeamId = 0,
        actorPlayerId = 0,
    ): void {
        const msg = new net.CaptureTheFlagMsg();
        msg.redScore = this.score.A;
        msg.blueScore = this.score.B;
        msg.scoreLimit = this.settings?.scoreLimit ?? 100;
        msg.matchTimeLeft = this.matchTimeLeft;
        msg.redFlagStatus = this.getNetStatus(this.flags.A);
        msg.blueFlagStatus = this.getNetStatus(this.flags.B);
        msg.redFlagPos = this.flags.A.pos;
        msg.blueFlagPos = this.flags.B.pos;
        msg.redFlagReturnTime =
            this.flags.A.status === "dropped" ? this.flags.A.droppedReturnTicker : 0;
        msg.blueFlagReturnTime =
            this.flags.B.status === "dropped" ? this.flags.B.droppedReturnTicker : 0;
        msg.droppedFlagReturnDuration = this.settings?.droppedFlagReturnTime ?? 0;
        msg.redCarrierId = this.flags.A.carrier?.__id ?? 0;
        msg.blueCarrierId = this.flags.B.carrier?.__id ?? 0;
        msg.event = event;
        msg.flagTeamId = flagTeamId;
        msg.actorTeamId = actorTeamId;
        msg.actorPlayerId = actorPlayerId;
        this.game.broadcastMsg(net.MsgType.CaptureTheFlag, msg);
    }

    private getNetStatus(flag: CtfFlag): net.CaptureTheFlagFlagStatus {
        switch (flag.status) {
            case "taken":
                return net.CaptureTheFlagFlagStatus.Taken;
            case "dropped":
                return net.CaptureTheFlagFlagStatus.Dropped;
            case "base":
                return net.CaptureTheFlagFlagStatus.AtBase;
        }
    }

    private getPlayerFlagTeam(player: Player): FlagTeam | undefined {
        if (player.arenaTeam === "A" || player.teamId === 1) return "A";
        if (player.arenaTeam === "B" || player.teamId === 2) return "B";
        return undefined;
    }

    private enemyTeam(team: FlagTeam): FlagTeam {
        return team === "A" ? "B" : "A";
    }
}
