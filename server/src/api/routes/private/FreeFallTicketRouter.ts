import { Hono } from "hono";
import { z } from "zod";
import type { Context } from "../..";
import { databaseEnabledMiddleware, validateParams } from "../../auth/middleware";
import { grantFreeFallTickets } from "../../freeFallTicket/ticketService";

const zGrantFreeFallTicketBody = z.object({
    finderUserId: z.string().min(1),
    gameId: z.string().min(1),
    recipientUserIds: z.array(z.string().min(1)).min(1).max(4),
});

export const FreeFallTicketRouter = new Hono<Context>().post(
    "/grant",
    databaseEnabledMiddleware,
    validateParams(zGrantFreeFallTicketBody),
    async (c) => {
        const grantedUserIds = await grantFreeFallTickets(c.req.valid("json"));
        return c.json({ grantedUserIds }, 200);
    },
);
