import { GunGameWeapons } from "../../../shared/deathmatch/gunGame";
import { DamageType } from "../../../shared/gameConfig";
import { LeaderboardMsg, MsgType } from "../../../shared/net/net";
import { ObjectType } from "../../../shared/net/objectSerializeFns";
import type { Game } from "./game";
import type { DamageParams } from "./objects/gameObject";
import type { Player } from "./objects/player";

export class GunGameManager {
    readonly enabled: boolean;
    winner?: Player;
    private leaderboardTicker = 0;

    constructor(readonly game: Game) {
        this.enabled = game.miniGame === "gun_game";
    }

    onKill(victim: Player, params: DamageParams) {
        if (!this.enabled || !this.game.started || this.game.over || this.winner) return;
        const source = params.source;
        if (
            source?.__type !== ObjectType.Player ||
            source === victim ||
            source.dead ||
            source.disconnected ||
            victim.disconnected ||
            source.teamId === victim.teamId ||
            params.damageType !== DamageType.Player ||
            params.isExplosion ||
            params.gameSourceType !== GunGameWeapons[source.gunGameStage]
        )
            return;
        if (source.gunGameStage === GunGameWeapons.length - 1) {
            this.winner = source;
        } else {
            source.gunGameStage++;
            source.applyGunGameLoadout();
        }
        this.broadcast();
    }

    getLeaderboard(): LeaderboardMsg {
        const msg = new LeaderboardMsg();
        msg.players = this.game.playerBarn.players
            .filter((p) => !p.spectatorOnly && !p.disconnected)
            .sort(
                (a, b) =>
                    b.gunGameStage - a.gunGameStage ||
                    b.kills - a.kills ||
                    a.__id - b.__id,
            )
            .map((p) => ({
                name: p.name,
                kills: p === this.winner ? GunGameWeapons.length : p.gunGameStage,
            }));
        return msg;
    }

    private broadcast() {
        this.game.broadcastMsg(MsgType.Leaderboard, this.getLeaderboard());
    }

    update(dt: number) {
        if (!this.enabled || this.game.over) return;
        this.leaderboardTicker -= dt;
        if (this.leaderboardTicker <= 0) {
            this.leaderboardTicker = 1;
            this.broadcast();
        }
    }

    handleGameEnd(): boolean {
        if (!this.game.started) return false;
        const players = this.game.playerBarn.players.filter(
            (p) => !p.spectatorOnly && !p.disconnected,
        );
        if (!this.winner && players.length === 1) this.winner = players[0];
        if (!this.winner && players.length > 0) return false;
        for (const player of this.game.playerBarn.players) {
            player.captureTheFlagRespawnTicker = 0;
            player.addGameOverMsg(this.winner?.teamId ?? 0, { gameOver: true });
        }
        return true;
    }
}
