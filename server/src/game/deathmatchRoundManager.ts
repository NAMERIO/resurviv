import { normalizeDeathmatchFirstTo } from "../../../shared/deathmatch/rounds";
import { type ArenaTeam, ArenaTeamIds } from "../../../shared/defs/miniGame";
import { DeathmatchRoundMsg, MsgType } from "../../../shared/net/net";
import { type Vec2, v2 } from "../../../shared/utils/v2";
import { isBattleRoyaleMapName } from "../battleroyale/helpers";
import type { Game } from "./game";
import { Gas } from "./objects/gas";
import type { Player } from "./objects/player";

export class DeathmatchRoundManager {
    readonly enabled: boolean;
    readonly firstTo;
    readonly score = new Map<ArenaTeam, number>();
    roundNumber = 1;
    roundOver = false;
    nextRoundIn = 0;
    winner?: ArenaTeam;
    private broadcastTicker = 0;
    private readonly spawns = new Map<Player, { pos: Vec2; layer: number }>();

    constructor(readonly game: Game) {
        this.enabled =
            game.arenaPrivate &&
            game.miniGame === "pvp" &&
            !isBattleRoyaleMapName(game.mapName);
        this.firstTo = normalizeDeathmatchFirstTo(game.config.deathmatchFirstTo);
    }

    registerPlayer(player: Player): void {
        if (!this.enabled || player.spectatorOnly || !player.arenaTeam) return;
        if (!this.score.has(player.arenaTeam)) this.score.set(player.arenaTeam, 0);
        if (player.perkSelectionPending) return;
        const key = player;
        if (!this.spawns.has(key)) {
            this.spawns.set(key, { pos: v2.copy(player.pos), layer: player.layer });
        }
    }

    getSpawn(player: Player) {
        return this.spawns.get(player);
    }

    isMatchOver(): boolean {
        return (
            this.roundOver &&
            !!this.winner &&
            (this.score.get(this.winner) ?? 0) >= this.firstTo
        );
    }

    update(dt: number): void {
        if (!this.enabled || this.game.over) return;
        for (const player of this.game.playerBarn.players) this.registerPlayer(player);
        if (this.game.started) {
            if (this.roundOver) {
                this.nextRoundIn = Math.max(0, this.nextRoundIn - dt);
                if (!this.isMatchOver() && this.nextRoundIn === 0) this.beginNextRound();
            } else {
                const livingTeams = new Set(
                    this.game.playerBarn.livingPlayers
                        .filter((p) => !p.dead && !p.disconnected && !p.spectatorOnly)
                        .map((p) => p.arenaTeam)
                        .filter((team) => team !== undefined),
                );
                if (livingTeams.size <= 1) {
                    this.winner = [...livingTeams][0];
                    if (this.winner)
                        this.score.set(
                            this.winner,
                            (this.score.get(this.winner) ?? 0) + 1,
                        );
                    this.roundOver = true;
                    this.nextRoundIn = 3;
                    for (const player of this.game.playerBarn.livingPlayers) {
                        player.cancelAction();
                        player.shootHold = player.shootStart = false;
                        player.moveLeft =
                            player.moveRight =
                            player.moveUp =
                            player.moveDown =
                                false;
                        player.touchMoveActive = false;
                    }
                    this.broadcast();
                    this.game.checkGameOver();
                }
            }
        }
        this.broadcastTicker -= dt;
        if (this.broadcastTicker <= 0) {
            this.broadcastTicker = 0.5;
            this.broadcast();
        }
    }

    private beginNextRound(): void {
        const connected = this.game.playerBarn.players.filter(
            (p) => !p.disconnected && !p.spectatorOnly,
        );
        if (connected.length === 0) {
            this.game.checkGameOver();
            return;
        }
        // Clear attacks from the previous round before restoring health and spawns.
        for (const bullet of this.game.bulletBarn.bullets) bullet.active = false;
        this.game.bulletBarn.damages.length = 0;
        for (const projectile of this.game.projectileBarn.projectiles)
            projectile.destroy();
        for (const smoke of this.game.smokeBarn.smokes) smoke.destroy();
        this.game.smokeBarn.emitters.length = 0;
        this.game.explosionBarn.explosions.length = 0;
        this.game.explosionBarn.newExplosions.length = 0;
        for (const airdrop of this.game.airdropBarn.airdrops) {
            if (!airdrop.destroyed) airdrop.destroy();
        }
        this.game.airdropBarn.airdrops.length = 0;
        this.game.planeBarn.resetRound();
        this.game.deadBodyBarn.clear();
        this.game.map.resetRound();
        this.game.gas = new Gas(this.game);
        this.game.gas.advanceGasStage();
        this.roundNumber++;
        this.roundOver = false;
        this.winner = undefined;
        for (const player of connected) player.resetEliminationRound();
        this.broadcast();
    }

    handleGameEnd(): boolean {
        if (!this.game.started) return false;
        const noPlayers = !this.game.playerBarn.players.some(
            (p) => !p.disconnected && !p.spectatorOnly,
        );
        if (!noPlayers && !this.isMatchOver()) return false;
        const winner = this.game.playerBarn.players.find(
            (p) => !noPlayers && p.arenaTeam === this.winner,
        );
        for (const player of this.game.playerBarn.players) {
            player.addGameOverMsg(winner?.teamId ?? 0, { gameOver: true });
        }
        return true;
    }

    getState(): DeathmatchRoundMsg {
        const msg = new DeathmatchRoundMsg();
        msg.firstTo = this.firstTo;
        msg.roundNumber = this.roundNumber;
        msg.roundOver = this.roundOver;
        msg.matchOver = this.isMatchOver();
        msg.nextRoundIn = this.nextRoundIn;
        msg.winner = this.winner;
        msg.teams = ArenaTeamIds.filter((team) => this.score.has(team)).map((team) => ({
            team,
            teamId:
                this.game.playerBarn.matchPlayers.find(
                    (player) => player.arenaTeam === team,
                )?.teamId ?? 0,
            wins: this.score.get(team) ?? 0,
        }));
        return msg;
    }

    private broadcast(): void {
        this.game.broadcastMsg(MsgType.DeathmatchRound, this.getState());
    }
}
