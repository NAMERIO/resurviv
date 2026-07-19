import type { ArenaTeam } from "../../../shared/defs/miniGame";
import { GameConfig } from "../../../shared/gameConfig";
import * as net from "../../../shared/net/net";
import { type Vec2, v2 } from "../../../shared/utils/v2";
import type { Game } from "./game";
import { getKingOfTheHillSettings } from "./privateLobbyMiniGames";

type HillTeam = "A" | "B";
type HillPhase = "active" | "countdown";

export class KingOfTheHillManager {
    readonly enabled: boolean;
    readonly settings;
    readonly score: Record<HillTeam, number> = { A: 0, B: 0 };
    private readonly hillLocations: Vec2[];
    private phase: HillPhase = "countdown";
    private phaseTicker = 0;
    private activeHillIdx = -1;
    private pendingHillIdx = -1;
    private hillQueue: number[] = [];
    private controllingTeamId = 0;
    private lastBroadcastSecond = -1;
    private lastBroadcastControl = -1;

    constructor(readonly game: Game) {
        const def = game.map.mapDef.gameMode.captureTheFlag;
        this.settings = getKingOfTheHillSettings(this.game.miniGame);
        this.enabled = !!def && !!this.settings;
        this.hillLocations = (
            def?.kingOfTheHillLocations?.length
                ? def.kingOfTheHillLocations
                : [
                      def?.redFlag ??
                          v2.create(game.map.width * 0.65, game.map.height / 2),
                      v2.create(game.map.width / 2, game.map.height / 2),
                      def?.blueFlag ??
                          v2.create(game.map.width * 0.35, game.map.height / 2),
                  ]
        ).map((pos) => v2.copy(pos));
    }

    init(): void {
        if (!this.enabled || !this.settings) return;
        this.activateNextHill();
        this.broadcast();
    }

    update(dt: number): void {
        if (!this.enabled || !this.settings || this.game.over || !this.game.started) {
            return;
        }

        const previousPhaseTicker = this.phaseTicker;
        this.phaseTicker -= dt;

        const scoringDt =
            this.phase === "countdown"
                ? Math.min(dt, Math.max(0, previousPhaseTicker))
                : dt;
        if (scoringDt > 0 && this.currentHillPos) {
            this.controllingTeamId = this.getControllingTeamId();
            if (this.controllingTeamId === 1) {
                this.score.A += this.settings.pointsPerSecond * scoringDt;
            } else if (this.controllingTeamId === 2) {
                this.score.B += this.settings.pointsPerSecond * scoringDt;
            }

            if (this.hasReachedScoreLimit()) {
                this.game.checkGameOver();
                this.broadcast();
                return;
            }
        }

        if (this.phase === "active") {
            if (this.phaseTicker <= 0) {
                this.startCountdown();
            }
        } else if (this.phaseTicker <= 0) {
            this.activateNextHill();
        }

        const secondsLeft = Math.ceil(this.phaseTicker);
        if (
            secondsLeft !== this.lastBroadcastSecond ||
            this.controllingTeamId !== this.lastBroadcastControl
        ) {
            this.broadcast();
        }
    }

    getSpawnPos(arenaTeam: ArenaTeam | undefined, teamId?: number): Vec2 | undefined {
        if (!this.enabled) return undefined;
        const def = this.game.map.mapDef.gameMode.captureTheFlag;
        const hillTeam =
            arenaTeam ?? (teamId === 1 ? "A" : teamId === 2 ? "B" : undefined);
        const center =
            hillTeam === "A"
                ? (def?.redSpawn ?? def?.redFlag)
                : hillTeam === "B"
                  ? (def?.blueSpawn ?? def?.blueFlag)
                  : undefined;
        if (!center) return undefined;
        const radius = def?.spawnRadius ?? 16;
        const pos = v2.add(center, v2.mul(v2.randomUnit(), Math.random() * radius));
        if (hillTeam === "A" && def?.redSpawnXRange) {
            const [minX, maxX] = def.redSpawnXRange;
            pos.x = minX + Math.random() * (maxX - minX);
        }
        return pos;
    }

    getWinningTeamId(): number {
        if (!this.enabled) return 0;
        if (Math.floor(this.score.A) === Math.floor(this.score.B)) return 0;
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

    private activateNextHill(): void {
        if (!this.settings || this.hillLocations.length === 0) return;
        const nextIdx =
            this.pendingHillIdx >= 0 ? this.pendingHillIdx : this.getNextHillIdx();
        this.activeHillIdx = nextIdx;
        this.pendingHillIdx = -1;
        this.phase = "active";
        this.phaseTicker = this.settings.hillDuration;
        this.controllingTeamId = 0;
        this.broadcast();
    }

    private startCountdown(): void {
        if (!this.settings) return;
        this.phase = "countdown";
        this.phaseTicker = this.settings.nextHillDelay;
        this.pendingHillIdx = this.getNextHillIdx();
        this.controllingTeamId = this.getControllingTeamId();
        this.broadcast();
    }

    private getNextHillIdx(): number {
        if (this.hillLocations.length <= 1) return 0;

        while (this.hillQueue.length === 0) {
            this.hillQueue = Array.from(
                { length: this.hillLocations.length },
                (_, idx) => idx,
            );
            for (let i = this.hillQueue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.hillQueue[i], this.hillQueue[j]] = [
                    this.hillQueue[j],
                    this.hillQueue[i],
                ];
            }
            if (
                this.hillQueue.length > 1 &&
                this.hillQueue[this.hillQueue.length - 1] === this.activeHillIdx
            ) {
                const swapIdx = Math.floor(Math.random() * (this.hillQueue.length - 1));
                [this.hillQueue[this.hillQueue.length - 1], this.hillQueue[swapIdx]] = [
                    this.hillQueue[swapIdx],
                    this.hillQueue[this.hillQueue.length - 1],
                ];
            }
        }
        return this.hillQueue.pop()!;
    }

    private getControllingTeamId(): number {
        const hillPos = this.currentHillPos;
        if (!hillPos) return 0;
        const teamsInHill = new Set<number>();
        const captureZoneSize =
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
            if (!teamId) continue;
            if (this.isInHill(player.pos, hillPos, captureZoneSize)) {
                teamsInHill.add(teamId);
            }
        }

        return teamsInHill.size === 1 ? [...teamsInHill][0] : 0;
    }

    private isInHill(pos: Vec2, center: Vec2, size: Vec2): boolean {
        const playerRadius = GameConfig.player.radius;
        return (
            Math.abs(pos.x - center.x) <= size.x / 2 + playerRadius &&
            Math.abs(pos.y - center.y) <= size.y / 2 + playerRadius
        );
    }

    private getPlayerTeamId(player: {
        teamId: number;
        arenaTeam?: ArenaTeam;
    }): 1 | 2 | 0 {
        if (player.arenaTeam === "A" || (!player.arenaTeam && player.teamId === 1)) {
            return 1;
        }
        if (player.arenaTeam === "B" || (!player.arenaTeam && player.teamId === 2)) {
            return 2;
        }
        return 0;
    }

    private get currentHillPos(): Vec2 | undefined {
        return this.hillLocations[this.activeHillIdx];
    }

    private get broadcastHillPos(): Vec2 | undefined {
        return this.phase === "countdown"
            ? this.hillLocations[this.pendingHillIdx]
            : this.currentHillPos;
    }

    private broadcast(): void {
        const msg = new net.KingOfTheHillMsg();
        msg.redScore = Math.floor(this.score.A);
        msg.blueScore = Math.floor(this.score.B);
        msg.scoreLimit = this.settings?.scoreLimit ?? 200;
        msg.phase =
            this.phase === "active"
                ? net.KingOfTheHillPhase.Active
                : net.KingOfTheHillPhase.Countdown;
        msg.hillPos = this.broadcastHillPos ?? v2.create(0, 0);
        msg.showPreviousHill = this.phase === "countdown" && !!this.currentHillPos;
        if (this.currentHillPos) {
            msg.previousHillPos = this.currentHillPos;
        }
        msg.phaseTimeLeft = Math.max(0, this.phaseTicker);
        msg.phaseDuration =
            this.phase === "active"
                ? (this.settings?.hillDuration ?? 60)
                : (this.settings?.nextHillDelay ?? 10);
        msg.matchTimeLeft = this.matchTimeLeft;
        msg.controllingTeamId = this.controllingTeamId;
        this.lastBroadcastSecond = Math.ceil(this.phaseTicker);
        this.lastBroadcastControl = this.controllingTeamId;
        this.game.broadcastMsg(net.MsgType.KingOfTheHill, msg);
    }
}
