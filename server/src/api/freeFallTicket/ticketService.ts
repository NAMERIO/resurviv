import { and, eq, gt, gte, inArray, sql } from "drizzle-orm";
import {
    FreeFallTicket,
    isFreeFallTicketLive,
} from "../../../../shared/defs/gameObjects/freeFallTicketDefs";
import type { FreeFallTicketState } from "../../../../shared/types/user";
import { logFreeFallTicketToDiscord } from "../../utils/shopLogging";
import { db } from "../db";
import {
    freeFallTicketRedemptionsTable,
    freeFallTicketsTable,
    usersTable,
} from "../db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function grantFreeFallTickets(params: {
    finderUserId: string;
    gameId: string;
    recipientUserIds: string[];
}) {
    if (!isFreeFallTicketLive()) return [];

    const { finderUserId, gameId, recipientUserIds } = params;
    const recipients = await db
        .select({ id: usersTable.id, slug: usersTable.slug })
        .from(usersTable)
        .where(
            and(inArray(usersTable.id, recipientUserIds), eq(usersTable.banned, false)),
        );

    if (recipients.length === 0) return [];

    const granted = await db
        .insert(freeFallTicketsTable)
        .values(
            recipients.map((recipient) => ({
                userId: recipient.id,
                finderUserId,
                gameId,
                expiresAt: new Date(FreeFallTicket.expiresAt),
            })),
        )
        .onConflictDoNothing({ target: freeFallTicketsTable.userId })
        .returning({ userId: freeFallTicketsTable.userId });

    const grantedUserIds = granted.map((row) => row.userId);
    if (grantedUserIds.length > 0) {
        const grantedSet = new Set(grantedUserIds);
        void logFreeFallTicketToDiscord({
            finderSlug:
                recipients.find((recipient) => recipient.id === finderUserId)?.slug ??
                finderUserId,
            recipientSlugs: recipients
                .filter((recipient) => grantedSet.has(recipient.id))
                .map((recipient) => recipient.slug),
        });
    }
    return grantedUserIds;
}

export function getActiveTicket(tx: any, userId: string) {
    return tx.query.freeFallTicketsTable.findFirst({
        where: and(
            eq(freeFallTicketsTable.userId, userId),
            gt(freeFallTicketsTable.expiresAt, new Date()),
        ),
        columns: { userId: true, expiresAt: true },
    }) as Promise<{ userId: string; expiresAt: Date } | undefined>;
}

export async function countFreeCratesLast24h(tx: any, userId: string) {
    const [row] = await tx
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(freeFallTicketRedemptionsTable)
        .where(
            and(
                eq(freeFallTicketRedemptionsTable.userId, userId),
                eq(freeFallTicketRedemptionsTable.kind, "crate"),
                gte(
                    freeFallTicketRedemptionsTable.createdAt,
                    new Date(Date.now() - DAY_MS),
                ),
            ),
        );
    return (row?.count ?? 0) as number;
}

export async function getFreeFallTicketState(
    userId: string,
): Promise<FreeFallTicketState | null> {
    const ticket = await getActiveTicket(db, userId);
    if (!ticket) return null;

    const cratesUsed = await countFreeCratesLast24h(db, userId);
    return {
        expiresAt: ticket.expiresAt.getTime(),
        freeCratesLeft: Math.max(0, FreeFallTicket.maxFreeCratesPer24h - cratesUsed),
    };
}

export async function lockTicketSpending(tx: any, userId: string) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ticket:${userId}`}))`);
}

export async function recordRedemption(
    tx: any,
    redemption: {
        userId: string;
        kind: "market" | "bundle" | "crate";
        referenceId: string;
        sellerUserId?: string;
        gpPaidToSeller?: number;
    },
) {
    await tx.insert(freeFallTicketRedemptionsTable).values(redemption);
}
