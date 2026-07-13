import type { ArenaTeam } from "../../../shared/defs/miniGame";
import { GameConfig } from "../../../shared/gameConfig";
import * as net from "../../../shared/net/net";
import { type Vec2, v2 } from "../../../shared/utils/v2";
import type { Game } from "./game";
import { getDominationSettings } from "./privateLobbyMiniGames";

type DominationTeam = "A" | "B";
type TeamId = 0 | 1 | 2;

interface DominationPointState {
    pos: Vec2;
    ownerTeamId: TeamId;
    capturingTeamId: TeamId;
    progress: number;
    captureDuration: number;
    contested: boolean;
    resetting: boolean;
    resetElapsed: number;
    resetStartProgress: number;
}

export class DominationManager {
    readonly enabled: boolean;
    readonly settings;
    readonly score: Record<DominationTeam, number> = { A: 0, B: 0 };
    private readonly points: DominationPointState[];
    private broadcastTicker = 0;

    constructor(readonly game: Game) {
        const def = game.map.mapDef.gameMode.captureTheFlag;
        this.settings = getDominationSettings(game.miniGame);
        this.enabled = !!def && !!this.settings;
        const locations = def?.dominationLocations ?? [];
        this.points = locations.map((pos) => ({
            pos: v2.copy(pos),
            ownerTeamId: 0,
            capturingTeamId: 0,
            progress: 0,
            captureDuration: this.settings?.neutralCaptureTime ?? 5,
            contested: false,
            resetting: false,
            resetElapsed: 0,
            resetStartProgress: 0,
        }));
    }

    init(): void {
        if (!this.enabled) return;
        this.broadcast();
    }

    update(dt: number): void {
        if (!this.enabled || !this.settings || this.game.over || !this.game.started) {
            return;
        }

        for (const point of this.points) {
            this.updatePoint(point, dt);
            if (point.ownerTeamId === 1) {
                this.score.A += this.settings.pointsPerSecond * dt;
            } else if (point.ownerTeamId === 2) {
                this.score.B += this.settings.pointsPerSecond * dt;
            }
        }

        if (this.hasReachedScoreLimit()) {
            this.broadcast();
            this.game.checkGameOver();
            return;
        }

        this.broadcastTicker -= dt;
        if (this.broadcastTicker <= 0) {
            this.broadcast();
            this.broadcastTicker = 0.1;
        }
    }

    getSpawnPos(arenaTeam: ArenaTeam | undefined, teamId?: number): Vec2 | undefined {
        if (!this.enabled) return undefined;
        const def = this.game.map.mapDef.gameMode.captureTheFlag;
        const team = arenaTeam ?? (teamId === 1 ? "A" : teamId === 2 ? "B" : undefined);
        const center =
            team === "A"
                ? (def?.redSpawn ?? def?.redFlag)
                : team === "B"
                  ? (def?.blueSpawn ?? def?.blueFlag)
                  : undefined;
        if (!center) return undefined;
        const radius = def?.spawnRadius ?? 16;
        const pos = v2.add(center, v2.mul(v2.randomUnit(), Math.random() * radius));
        if (team === "A" && def?.redSpawnXRange) {
            const [minX, maxX] = def.redSpawnXRange;
            pos.x = minX + Math.random() * (maxX - minX);
        }
        return pos;
    }

    getWinningTeamId(): TeamId {
        if (!this.enabled || Math.floor(this.score.A) === Math.floor(this.score.B)) {
            return 0;
        }
        return this.score.A > this.score.B ? 1 : 2;
    }

    hasReachedScoreLimit(): boolean {
        return (
            !!this.enabled &&
            !!this.settings &&
            (this.score.A >= this.settings.scoreLimit ||
                this.score.B >= this.settings.scoreLimit)
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

    private updatePoint(point: DominationPointState, dt: number): void {
        if (!this.settings) return;
        const teams = this.getTeamsInPoint(point);
        point.contested = teams.size > 1;
        if (point.contested) return;

        const teamId = teams.size === 1 ? [...teams][0] : 0;
        if (teamId !== 0 && teamId === point.capturingTeamId && point.progress > 0) {
            point.resetting = false;
            point.resetElapsed = 0;
            point.progress = Math.min(point.captureDuration, point.progress + dt);
            if (point.progress >= point.captureDuration) {
                point.ownerTeamId = teamId;
                this.clearCapture(point);
            }
            return;
        }

        if (point.progress > 0) {
            this.resetCapture(point, dt);
            return;
        }

        if (teamId === 0 || teamId === point.ownerTeamId) return;
        point.capturingTeamId = teamId;
        point.captureDuration =
            point.ownerTeamId === 0
                ? this.settings.neutralCaptureTime
                : this.settings.enemyCaptureTime;
        point.progress = Math.min(point.captureDuration, dt);
    }

    private resetCapture(point: DominationPointState, dt: number): void {
        if (!this.settings) return;
        if (!point.resetting) {
            point.resetting = true;
            point.resetElapsed = 0;
            point.resetStartProgress = point.progress;
        }
        point.resetElapsed += dt;
        const resetProgress = Math.max(0, point.resetElapsed - this.settings.resetDelay);
        if (resetProgress <= 0) return;
        point.progress =
            point.resetStartProgress *
            Math.max(0, 1 - resetProgress / this.settings.resetDuration);
        if (point.progress <= 0) this.clearCapture(point);
    }

    private clearCapture(point: DominationPointState): void {
        point.capturingTeamId = 0;
        point.progress = 0;
        point.captureDuration = this.settings?.neutralCaptureTime ?? 5;
        point.resetting = false;
        point.resetElapsed = 0;
        point.resetStartProgress = 0;
    }

    private getTeamsInPoint(point: DominationPointState): Set<1 | 2> {
        const teams = new Set<1 | 2>();
        const size =
            this.game.map.mapDef.gameMode.captureTheFlag?.captureZoneSize ??
            v2.create(16, 24);
        for (const player of this.game.playerBarn.livingPlayers) {
            if (
                player.dead ||
                player.downed ||
                player.disconnected ||
                player.spectatorOnly
            ) {
                continue;
            }
            const teamId = this.getPlayerTeamId(player);
            if (teamId && this.isInPoint(player.pos, point.pos, size)) teams.add(teamId);
        }
        return teams;
    }

    private isInPoint(pos: Vec2, center: Vec2, size: Vec2): boolean {
        const radius = GameConfig.player.radius;
        return (
            Math.abs(pos.x - center.x) <= size.x / 2 + radius &&
            Math.abs(pos.y - center.y) <= size.y / 2 + radius
        );
    }

    private getPlayerTeamId(player: {
        teamId: number;
        arenaTeam?: ArenaTeam;
    }): 0 | 1 | 2 {
        if (player.arenaTeam === "A" || (!player.arenaTeam && player.teamId === 1)) {
            return 1;
        }
        if (player.arenaTeam === "B" || (!player.arenaTeam && player.teamId === 2)) {
            return 2;
        }
        return 0;
    }

    private broadcast(): void {
        const msg = new net.DominationMsg();
        msg.redScore = Math.floor(this.score.A);
        msg.blueScore = Math.floor(this.score.B);
        msg.scoreLimit = this.settings?.scoreLimit ?? 700;
        msg.matchTimeLeft = this.matchTimeLeft;
        msg.points = this.points.map((point) => ({
            pos: v2.copy(point.pos),
            ownerTeamId: point.ownerTeamId,
            capturingTeamId: point.capturingTeamId,
            progress: point.progress,
            captureDuration: point.captureDuration,
            contested: point.contested,
            resetting: point.resetting,
        }));
        this.game.broadcastMsg(net.MsgType.Domination, msg);
    }
}
