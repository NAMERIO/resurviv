import { and, eq, gte, or, sql } from "drizzle-orm";
import { FreeFallTicketGuard } from "../../../../shared/defs/gameObjects/freeFallTicketDefs";
import type { FreeFallTicketRefusal } from "../../../../shared/types/user";
import {
    freeFallTicketRedemptionsTable,
    gpGiftTable,
    ipLogsTable,
    matchDataTable,
    skinGiftTable,
    userFriendsTable,
    usersTable,
} from "../db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

export type MarketRedemptionFacts = {
    price: number;
    listingAgeMs: number;
    sellerAccountAgeMs: number;
    sellerMatches: number;
    sharedIp: boolean;
    friends: boolean;
    giftHistory: boolean;
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
    if (facts.sharedIp || facts.friends || facts.giftHistory) {
        return "ticket_seller_linked";
    }
    if (facts.redemptionsFromSeller >= guard.maxRedemptionsPerSeller) {
        return "ticket_seller_limit";
    }
    if (facts.gpPaidOutLast24h + facts.price > guard.maxSellerPayoutPer24h) {
        return "ticket_daily_limit";
    }
    return null;
}

async function getUserIpHashes(tx: any, userId: string) {
    const rows: Array<{ encodedIp: string; findGameEncodedIp: string }> = await tx
        .selectDistinct({
            encodedIp: ipLogsTable.encodedIp,
            findGameEncodedIp: ipLogsTable.findGameEncodedIp,
        })
        .from(ipLogsTable)
        .where(eq(ipLogsTable.userId, userId));

    return new Set(rows.flatMap((row) => [row.encodedIp, row.findGameEncodedIp]));
}

async function accountsShareIp(
    tx: any,
    buyerUserId: string,
    sellerUserId: string,
    buyerIpHash: string,
    sellerIpHash: string,
) {
    const [buyerIps, sellerIps] = [
        await getUserIpHashes(tx, buyerUserId),
        await getUserIpHashes(tx, sellerUserId),
    ];
    buyerIps.add(buyerIpHash);
    sellerIps.add(sellerIpHash);
    buyerIps.delete("");
    sellerIps.delete("");

    for (const ip of buyerIps) {
        if (sellerIps.has(ip)) return true;
    }
    return false;
}

function betweenUsers(senderColumn: any, recipientColumn: any, a: string, b: string) {
    return or(
        and(eq(senderColumn, a), eq(recipientColumn, b)),
        and(eq(senderColumn, b), eq(recipientColumn, a)),
    );
}

export async function checkMarketRedemption(
    tx: any,
    params: {
        buyerUserId: string;
        buyerIpHash: string;
        listing: {
            sellerUserId: string;
            sellerIpHash: string;
            price: number;
            createdAt: Date;
        };
    },
): Promise<FreeFallTicketRefusal | null> {
    const { buyerUserId, buyerIpHash, listing } = params;
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

    const friendRows = await tx
        .select({ id: userFriendsTable.id })
        .from(userFriendsTable)
        .where(
            and(
                eq(userFriendsTable.status, "accepted"),
                betweenUsers(
                    userFriendsTable.requesterUserId,
                    userFriendsTable.addresseeUserId,
                    buyerUserId,
                    sellerUserId,
                ),
            ),
        )
        .limit(1);

    const gpGiftRows = await tx
        .select({ id: gpGiftTable.id })
        .from(gpGiftTable)
        .where(
            betweenUsers(
                gpGiftTable.senderUserId,
                gpGiftTable.recipientUserId,
                buyerUserId,
                sellerUserId,
            ),
        )
        .limit(1);

    const skinGiftRows = await tx
        .select({ id: skinGiftTable.id })
        .from(skinGiftTable)
        .where(
            betweenUsers(
                skinGiftTable.senderUserId,
                skinGiftTable.recipientUserId,
                buyerUserId,
                sellerUserId,
            ),
        )
        .limit(1);

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
        sharedIp: await accountsShareIp(
            tx,
            buyerUserId,
            sellerUserId,
            buyerIpHash,
            listing.sellerIpHash,
        ),
        friends: friendRows.length > 0,
        giftHistory: gpGiftRows.length > 0 || skinGiftRows.length > 0,
        redemptionsFromSeller: sellerRedemptions?.count ?? 0,
        gpPaidOutLast24h: recentPayout?.total ?? 0,
    });
}
