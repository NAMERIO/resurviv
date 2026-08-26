import type { ArenaTeam } from "../../../shared/defs/miniGame";
import { DamageType } from "../../../shared/gameConfig";
import * as net from "../../../shared/net/net";
import { ObjectType } from "../../../shared/net/objectSerializeFns";
import { type Vec2, v2 } from "../../../shared/utils/v2";
import type { Game } from "./game";
import type { DamageParams } from "./objects/gameObject";
import type { Obstacle } from "./objects/obstacle";
import type { Player } from "./objects/player";
import { getBedWarSettings, isBedWarMiniGame } from "./privateLobbyMiniGames";

type BedTeam = "A" | "B";

const grenadeTypes = new Set(["frag", "mirv", "mirv_mini", "40mm_grenade"]);

interface BedObjective {
    teamId: 1 | 2;
    alive: boolean;
    object?: Obstacle;
}

export class BedWarManager {
    readonly enabled: boolean;
    readonly settings;
    readonly beds: Record<BedTeam, BedObjective>;
    private lastRedHealth = -1;
    private lastBlueHealth = -1;
    private lastBroadcastSecond = -1;
    private suddenDeathStarted = false;
    private destroyingBedsForSuddenDeath = false;
    private revealPingTicker = 0;

    constructor(readonly game: Game) {
        const def = game.map.mapDef.gameMode.bedWar;
        this.settings = getBedWarSettings(game.miniGame);
        this.enabled = isBedWarMiniGame(game.miniGame) && !!def && !!this.settings;

        this.beds = {
            A: this.createBed(1),
            B: this.createBed(2),
        };
    }

    init(): void {
        if (!this.enabled) return;
        this.bindMapBeds();
        this.broadcast();
    }

    update(dt: number): void {
        if (!this.enabled || this.game.over) return;
        this.bindMapBeds();

        if (this.game.started && this.matchTimeLeft <= 0 && !this.suddenDeathStarted) {
            this.startSuddenDeath();
        }
        this.updateBedlessTeamPings(dt);

        const redHealth = this.getBedHealth(this.beds.A);
        const blueHealth = this.getBedHealth(this.beds.B);
        const secondsLeft = Math.ceil(this.matchTimeLeft);
        if (
            redHealth !== this.lastRedHealth ||
            blueHealth !== this.lastBlueHealth ||
            secondsLeft !== this.lastBroadcastSecond
        ) {
            this.broadcast();
        }
    }

    canDamageBed(obstacle: Obstacle, params: DamageParams): boolean {
        if (!this.enabled) return true;
        const bed = this.getBedForObject(obstacle);
        if (!bed) return true;
        if (!this.game.started || this.game.over || !bed.alive) return false;

        const source =
            params.source?.__type === ObjectType.Player
                ? (params.source as Player)
                : undefined;
        if (!source || source.dead || source.disconnected) return false;
        const sourceTeamId = this.getPlayerTeamId(source);
        return sourceTeamId !== 0 && sourceTeamId !== bed.teamId;
    }

    getBedDamageMultiplier(obstacle: Obstacle, params: DamageParams): number {
        if (!this.enabled || !this.getBedForObject(obstacle)) return 1;
        if (!params.isExplosion || !grenadeTypes.has(params.gameSourceType ?? "")) {
            return 1;
        }
        return this.settings?.grenadeDamageMultiplier ?? 0.1;
    }

    onObstacleDestroyed(obstacle: Obstacle, params: DamageParams): void {
        if (!this.enabled) return;
        const bed = this.getBedForObject(obstacle);
        if (!bed || !bed.alive) return;

        bed.alive = false;

        const source =
            params.source?.__type === ObjectType.Player
                ? (params.source as Player)
                : undefined;
        if (!this.destroyingBedsForSuddenDeath) {
            this.broadcast(
                net.BedWarEvent.BedDestroyed,
                bed.teamId,
                source ? this.getPlayerTeamId(source) : 0,
                source?.__id ?? 0,
            );
        }

        for (const player of this.game.playerBarn.players) {
            if (
                this.getPlayerTeamId(player) !== bed.teamId ||
                !player.dead ||
                player.captureTheFlagRespawnTicker <= 0
            ) {
                continue;
            }
            player.captureTheFlagRespawnTicker = 0;
            player.addGameOverMsg();
        }

        this.game.playerBarn.aliveCountDirty = true;
        if (!this.destroyingBedsForSuddenDeath) {
            this.game.checkGameOver();
        }
    }

    canRespawn(player: Player): boolean {
        if (!this.enabled) return false;
        const team = this.getPlayerBedTeam(player);
        return !!team && this.beds[team].alive;
    }

    getSpawnPos(arenaTeam: ArenaTeam | undefined, teamId?: number): Vec2 | undefined {
        if (!this.enabled) return undefined;
        const def = this.game.map.mapDef.gameMode.bedWar;
        const team = arenaTeam ?? (teamId === 1 ? "A" : teamId === 2 ? "B" : undefined);
        if (team !== "A" && team !== "B") return undefined;

        const center =
            (team === "A" ? def?.redSpawn : def?.blueSpawn) ??
            this.beds[team].object?.pos ??
            this.game.map.center;
        const radius = def?.spawnRadius ?? 8;
        return v2.add(center, v2.mul(v2.randomUnit(), Math.random() * radius));
    }

    isMatchOver(): boolean {
        if (!this.enabled || !this.game.started) return false;
        return this.isTeamEliminated(1) || this.isTeamEliminated(2);
    }

    getWinningTeamId(): number {
        if (!this.enabled) return 0;
        const redEliminated = this.isTeamEliminated(1);
        const blueEliminated = this.isTeamEliminated(2);
        if (redEliminated === blueEliminated) return 0;
        return redEliminated ? 2 : 1;
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

    private startSuddenDeath(): void {
        this.suddenDeathStarted = true;
        this.destroyingBedsForSuddenDeath = true;

        for (const bed of Object.values(this.beds)) {
            if (!bed.alive) continue;
            if (bed.object && !bed.object.dead) {
                bed.object.kill({
                    damageType: DamageType.Gas,
                    dir: v2.create(0, 0),
                });
            } else {
                bed.alive = false;
            }
        }

        this.destroyingBedsForSuddenDeath = false;
        this.broadcast(net.BedWarEvent.SuddenDeath);
        this.game.playerBarn.aliveCountDirty = true;
        this.game.checkGameOver();
    }

    private updateBedlessTeamPings(dt: number): void {
        if (!this.game.started || (this.beds.A.alive && this.beds.B.alive)) {
            this.revealPingTicker = 0;
            return;
        }

        this.revealPingTicker -= dt;
        if (this.revealPingTicker > 0) return;
        this.revealPingTicker = this.settings?.revealPingInterval ?? 10;

        for (const player of this.game.playerBarn.livingPlayers) {
            if (player.dead || player.disconnected || player.spectatorOnly) continue;
            const team = this.getPlayerBedTeam(player);
            if (!team || this.beds[team].alive) continue;

            this.game.playerBarn.addMapPing(
                "ping_danger",
                v2.copy(player.pos),
                player.__id,
                undefined,
                true,
            );
        }
    }

    private createBed(teamId: 1 | 2): BedObjective {
        return {
            teamId,
            alive: false,
        };
    }

    private bindMapBeds(): void {
        for (const obstacle of this.game.map.obstacles) {
            if (obstacle.type !== "bed_war_01") continue;
            const team =
                obstacle.puzzlePiece === "bed_war_red"
                    ? "A"
                    : obstacle.puzzlePiece === "bed_war_blue"
                      ? "B"
                      : undefined;
            if (!team || this.beds[team].object) continue;
            this.beds[team].object = obstacle;
            this.beds[team].alive = !obstacle.dead;
        }
    }

    private getBedHealth(bed: BedObjective): number {
        return bed.alive ? Math.ceil(bed.object?.health ?? 0) : 0;
    }

    private getBedForObject(obstacle: Obstacle): BedObjective | undefined {
        return Object.values(this.beds).find((bed) => bed.object === obstacle);
    }

    private getPlayerBedTeam(player: Player): BedTeam | undefined {
        if (player.arenaTeam === "A" || (!player.arenaTeam && player.teamId === 1)) {
            return "A";
        }
        if (player.arenaTeam === "B" || (!player.arenaTeam && player.teamId === 2)) {
            return "B";
        }
        return undefined;
    }

    private getPlayerTeamId(player: Player): number {
        const team = this.getPlayerBedTeam(player);
        return team === "A" ? 1 : team === "B" ? 2 : 0;
    }

    private isTeamEliminated(teamId: 1 | 2): boolean {
        const bed = teamId === 1 ? this.beds.A : this.beds.B;
        const hasConnectedPlayers = this.game.playerBarn.players.some(
            (player) =>
                !player.disconnected &&
                !player.spectatorOnly &&
                this.getPlayerTeamId(player) === teamId,
        );
        if (!hasConnectedPlayers) return true;
        if (bed.alive) return false;
        return !this.game.playerBarn.livingPlayers.some(
            (player) =>
                !player.disconnected &&
                !player.spectatorOnly &&
                this.getPlayerTeamId(player) === teamId,
        );
    }

    private broadcast(
        event = net.BedWarEvent.None,
        bedTeamId = 0,
        actorTeamId = 0,
        actorPlayerId = 0,
    ): void {
        const msg = new net.BedWarMsg();
        msg.redBedAlive = this.beds.A.alive;
        msg.blueBedAlive = this.beds.B.alive;
        msg.redBedHealth = this.getBedHealth(this.beds.A);
        msg.blueBedHealth = this.getBedHealth(this.beds.B);
        msg.maxBedHealth = Math.max(
            this.beds.A.object?.maxHealth ?? 0,
            this.beds.B.object?.maxHealth ?? 0,
            1,
        );
        msg.matchTimeLeft = this.matchTimeLeft;
        msg.event = event;
        msg.bedTeamId = bedTeamId;
        msg.actorTeamId = actorTeamId;
        msg.actorPlayerId = actorPlayerId;
        this.lastRedHealth = msg.redBedHealth;
        this.lastBlueHealth = msg.blueBedHealth;
        this.lastBroadcastSecond = Math.ceil(msg.matchTimeLeft);
        this.game.broadcastMsg(net.MsgType.BedWar, msg);
    }
}
