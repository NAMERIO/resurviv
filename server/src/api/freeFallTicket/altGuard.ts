import { and, eq, gte, sql } from "drizzle-orm";
import { FreeFallTicketGuard } from "../../../../shared/defs/gameObjects/freeFallTicketDefs";
import type { FreeFallTicketRefusal } from "../../../../shared/types/user";
import { freeFallTicketRedemptionsTable, matchDataTable, usersTable } from "../db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

export type MarketRedemptionFacts = {
    price: number;
    listingAgeMs: number;
    sellerAccountAgeMs: number;
    sellerMatches: number;
    redemptionsFromSeller: number;
    gpPaidOutLast24h: number;
};

export function decideMarketRedemption(
    facts: MarketRedemptionFacts,
): FreeFallTicketRefusal | null {
    const guard = FreeFallTicketGuard;

    if (facts.listingAgeMs < guard.minListingAgeMs) {
        return "ticket_listing_too_new";
    }
    if (
        facts.sellerAccountAgeMs < guard.minSellerAccountAgeMs ||
        facts.sellerMatches < guard.minSellerMatches
    ) {
        return "ticket_seller_new";
    }
    if (facts.redemptionsFromSeller >= guard.maxRedemptionsPerSeller) {
        return "ticket_seller_limit";
    }
    if (facts.gpPaidOutLast24h + facts.price > guard.maxSellerPayoutPer24h) {
        return "ticket_daily_limit";
    }
    return null;
}

export async function checkMarketRedemption(
    tx: any,
    params: {
        buyerUserId: string;
        listing: {
            sellerUserId: string;
            price: number;
            createdAt: Date;
        };
    },
): Promise<FreeFallTicketRefusal | null> {
    const { buyerUserId, listing } = params;
    const { sellerUserId } = listing;
    const now = Date.now();

    const seller = await tx.query.usersTable.findFirst({
        where: eq(usersTable.id, sellerUserId),
        columns: { userCreated: true, banned: true },
    });
    if (!seller || seller.banned) {
        return "ticket_seller_new";
    }

    const sellerMatchRows = await tx
        .select({ one: sql`1` })
        .from(matchDataTable)
        .where(eq(matchDataTable.userId, sellerUserId))
        .limit(FreeFallTicketGuard.minSellerMatches);

    const [sellerRedemptions] = await tx
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(freeFallTicketRedemptionsTable)
        .where(
            and(
                eq(freeFallTicketRedemptionsTable.userId, buyerUserId),
                eq(freeFallTicketRedemptionsTable.sellerUserId, sellerUserId),
            ),
        );

    const [recentPayout] = await tx
        .select({
            total: sql<number>`COALESCE(SUM(${freeFallTicketRedemptionsTable.gpPaidToSeller}), 0)::int`,
        })
        .from(freeFallTicketRedemptionsTable)
        .where(
            and(
                eq(freeFallTicketRedemptionsTable.userId, buyerUserId),
                gte(freeFallTicketRedemptionsTable.createdAt, new Date(now - DAY_MS)),
            ),
        );

    return decideMarketRedemption({
        price: listing.price,
        listingAgeMs: now - listing.createdAt.getTime(),
        sellerAccountAgeMs: now - seller.userCreated.getTime(),
        sellerMatches: sellerMatchRows.length,
        redemptionsFromSeller: sellerRedemptions?.count ?? 0,
        gpPaidOutLast24h: recentPayout?.total ?? 0,
    });
}
