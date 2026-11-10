import { randomInt } from "node:crypto";
import { isFreeFallTicketLive } from "../../../shared/defs/gameObjects/freeFallTicketDefs";
import * as net from "../../../shared/net/net";
import type { Vec2 } from "../../../shared/utils/v2";
import { Config } from "../config";
import { apiPrivateRouter } from "../utils/serverHelpers";
import type { Game } from "./game";
import type { Player } from "./objects/player";

export class FreeFallTicketDrop {
    private foundThisMatch = false;

    constructor(readonly game: Game) {}

    rollForCrate(opener: Player, pos: Vec2, layer: number) {
        const game = this.game;
        if (this.foundThisMatch || game.arenaPrivate) return;
        if (!opener.userId || !isFreeFallTicketLive()) return;

        const { dropOneIn, minDistinctIps } = Config.freeFallTicket;
        const ips = new Set(game.playerBarn.players.map((p) => p.encodedIp));
        if (ips.size < minDistinctIps) return;

        if (randomInt(dropOneIn) !== 0) return;

        this.foundThisMatch = true;
        void this.grant(opener, pos, layer);
    }

    private async grant(opener: Player, pos: Vec2, layer: number) {
        const game = this.game;
        const squad = opener.group ? opener.group.players : [opener];
        const recipients = squad.filter((p) => p.userId);

        try {
            const res = await apiPrivateRouter.free_fall_ticket.grant.$post({
                json: {
                    finderUserId: opener.userId!,
                    gameId: game.id,
                    recipientUserIds: [...new Set(recipients.map((p) => p.userId!))],
                },
            });
            if (!res.ok) {
                game.logger.error(`Free Fall Ticket grant failed: HTTP ${res.status}`);
                return;
            }

            const { grantedUserIds } = await res.json();
            const granted = new Set(grantedUserIds);
            const receivers = recipients.filter((p) => granted.has(p.userId!));
            if (receivers.length === 0) return;

            const msg = new net.FreeFallTicketMsg();
            msg.finderId = opener.__id;
            msg.recipientIds = receivers.map((p) => p.__id);
            msg.pos = pos;
            msg.layer = layer;
            game.broadcastMsg(net.MsgType.FreeFallTicket, msg);
        } catch (err) {
            game.logger.error("Failed to grant Free Fall Ticket:", err);
        }
    }
}
