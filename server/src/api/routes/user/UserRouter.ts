import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { GameObjectDefs } from "../../../../../shared/defs/gameObjectDefs";
import { UnlockDefs } from "../../../../../shared/defs/gameObjects/unlockDefs";
import { Rarity } from "../../../../../shared/gameConfig";
import {
    type AckSoldMarketListingsResponse,
    type BuyMarketListingResponse,
    type CancelMarketListingResponse,
    type CreateMarketListingResponse,
    type GetMarketResponse,
    type LoadoutResponse,
    type ProfileResponse,
    type UsernameResponse,
    zAckSoldMarketListingsRequest,
    zBuyMarketListingRequest,
    zCancelMarketListingRequest,
    zCreateMarketListingRequest,
    zLoadoutRequest,
    zSetItemStatusRequest,
    zUsernameRequest,
} from "../../../../../shared/types/user";
import loadout from "../../../../../shared/utils/loadout";
import { getMarketPriceBounds } from "../../../../../shared/utils/marketPricing";
import { validateUserName } from "../../../utils/serverHelpers";
import { server } from "../../apiServer";
import {
    authMiddleware,
    databaseEnabledMiddleware,
    rateLimitMiddleware,
    validateParams,
} from "../../auth/middleware";
import { db } from "../../db";
import {
    itemsTable,
    marketListingTable,
    matchDataTable,
    usersTable,
} from "../../db/schema";
import type { Context } from "../../index";
import {
    getTimeUntilNextUsernameChange,
    logoutUser,
    sanitizeSlug,
} from "./auth/authUtils";
import { PassRouter } from "./PassRouter";

export const UserRouter = new Hono<Context>();

const MARKET_LISTING_EXPIRY_MS = 24 * 60 * 60 * 1000;

function isSupportedMarketItem(itemType: string) {
    return getMarketPriceBounds(itemType) !== null;
}

async function expireMarketListings(tx: any, targetUserId?: string) {
    const cutoff = new Date(Date.now() - MARKET_LISTING_EXPIRY_MS);
    const expiredNow = await tx
        .update(marketListingTable)
        .set({
            status: "expired",
            canceledAt: new Date(),
        })
        .where(
            and(
                eq(marketListingTable.status, "active"),
                sql`${marketListingTable.createdAt} <= ${cutoff}`,
            ),
        )
        .returning({
            sellerUserId: marketListingTable.sellerUserId,
            itemId: marketListingTable.itemId,
            itemType: marketListingTable.itemType,
        });

    if (expiredNow.length === 0) {
        return [];
    }

    await tx
        .insert(itemsTable)
        .values(
            expiredNow.map(
                (listing: {
                    sellerUserId: string;
                    itemId: string;
                    itemType: string;
                }) => ({
                    id: listing.itemId,
                    userId: listing.sellerUserId,
                    type: listing.itemType,
                    source: "Item expired",
                    timeAcquired: Date.now(),
                }),
            ),
        )
        .onConflictDoNothing();

    if (!targetUserId) {
        return [];
    }

    return expiredNow
        .filter(
            (listing: { sellerUserId: string; itemType: string }) =>
                listing.sellerUserId === targetUserId,
        )
        .map((listing: { sellerUserId: string; itemType: string }) => listing.itemType);
}

async function buildMarketState(userId: string) {
    const expiredItemTypes = await expireMarketListings(db, userId);
    const [publicListings, userListings, soldListings, sellers] = await Promise.all([
        db.query.marketListingTable.findMany({
            where: eq(marketListingTable.status, "active"),
            orderBy: (table, { asc }) => [asc(table.price), asc(table.createdAt)],
        }),
        db.query.marketListingTable.findMany({
            where: and(
                eq(marketListingTable.sellerUserId, userId),
                eq(marketListingTable.status, "active"),
            ),
            orderBy: (table, { desc }) => [desc(table.createdAt)],
        }),
        db.query.marketListingTable.findMany({
            where: and(
                eq(marketListingTable.sellerUserId, userId),
                eq(marketListingTable.status, "sold"),
                sql`${marketListingTable.sellerNotifiedAt} IS NULL`,
            ),
            orderBy: (table, { asc }) => [asc(table.soldAt)],
        }),
        db.query.usersTable.findMany({
            columns: {
                id: true,
                slug: true,
            },
        }),
    ]);

    const slugByUserId = new Map(sellers.map((seller) => [seller.id, seller.slug]));
    const toClientListing = (listing: (typeof publicListings)[number]) => ({
        id: listing.id,
        itemId: listing.itemId,
        itemType: listing.itemType,
        price: listing.price,
        sellerSlug: slugByUserId.get(listing.sellerUserId) || "unknown",
        createdAt: new Date(listing.createdAt).getTime(),
    });

    return {
        listings: publicListings.map(toClientListing),
        userListings: userListings.map(toClientListing),
        soldListings: soldListings.map((listing) => ({
            id: listing.id,
            itemId: listing.itemId,
            itemType: listing.itemType,
            price: listing.price,
            soldAt: listing.soldAt ? new Date(listing.soldAt).getTime() : Date.now(),
        })),
        expiredItemTypes,
    };
}

UserRouter.use(databaseEnabledMiddleware);
UserRouter.use(rateLimitMiddleware(40, 60 * 1000));
UserRouter.use(authMiddleware);
UserRouter.route("/", PassRouter);

UserRouter.post("/profile", async (c) => {
    const user = c.get("user")!;

    const {
        loadout,
        slug,
        linked,
        username,
        usernameSet,
        lastUsernameChangeTime,
        banned,
        banReason,
    } = user;

    if (banned) {
        const session = c.get("session")!;
        await logoutUser(c, session.id);

        return c.json<ProfileResponse>({
            banned: true,
            reason: banReason,
        });
    }

    const timeUntilNextChange = getTimeUntilNextUsernameChange(lastUsernameChangeTime);

    const defaultUnlockItems = UnlockDefs["unlock_default"].unlocks;

    const items = await db
        .select({
            id: itemsTable.id,
            type: itemsTable.type,
            timeAcquired: itemsTable.timeAcquired,
            source: itemsTable.source,
            status: itemsTable.status,
        })
        .from(itemsTable)
        .where(
            and(
                eq(itemsTable.userId, user.id),
                notInArray(itemsTable.type, defaultUnlockItems),
            ),
        );

    return c.json<ProfileResponse>(
        {
            success: true,
            profile: {
                slug,
                linked,
                username,
                usernameSet,
                usernameChangeTime: timeUntilNextChange,
            },
            gpBalance: user.gpBalance,
            loadout,
            items: items,
        },
        200,
    );
});

UserRouter.post(
    "/username",
    validateParams(zUsernameRequest, { result: "invalid" } satisfies UsernameResponse),
    async (c) => {
        const user = c.get("user")!;
        const { username } = c.req.valid("json");
        const timeUntilNextChange = getTimeUntilNextUsernameChange(
            user.lastUsernameChangeTime,
        );

        if (timeUntilNextChange > 0) {
            return c.json<UsernameResponse>({ result: "change_time_not_expired" }, 200);
        }

        const { validName, originalWasInvalid } = validateUserName(username);

        if (originalWasInvalid) {
            return c.json<UsernameResponse>({ result: "invalid" }, 200);
        }

        const slug = sanitizeSlug(validName);

        const slugTaken = await db.query.usersTable.findFirst({
            where: and(eq(usersTable.slug, slug), ne(usersTable.id, user.id)),
            columns: {
                id: true,
            },
        });

        if (slugTaken) {
            return c.json<UsernameResponse>({ result: "taken" }, 200);
        }

        try {
            await db
                .update(usersTable)
                .set({
                    username: validName,
                    slug: slug,
                    usernameSet: true,
                    lastUsernameChangeTime: new Date(),
                })
                .where(eq(usersTable.id, user.id));
        } catch (err) {
            server.logger.error("/api/username: Error updating username", err);
            return c.json<UsernameResponse>({ result: "failed" }, 500);
        }

        return c.json<UsernameResponse>({ result: "success" }, 200);
    },
);

UserRouter.post("/loadout", validateParams(zLoadoutRequest), async (c) => {
    const user = c.get("user")!;
    const { loadout: userLoadout } = c.req.valid("json");

    const items = await db
        .select({
            id: itemsTable.id,
            type: itemsTable.type,
            timeAcquired: itemsTable.timeAcquired,
            source: itemsTable.source,
            status: itemsTable.status,
        })
        .from(itemsTable)
        .where(eq(itemsTable.userId, user.id));

    const validatedLoadout = loadout.validateWithAvailableItems(userLoadout, items);

    await db
        .update(usersTable)
        .set({ loadout: validatedLoadout })
        .where(eq(usersTable.id, user.id));

    return c.json<LoadoutResponse>(
        {
            loadout: validatedLoadout,
        },
        200,
    );
});

UserRouter.post("/logout", async (c) => {
    const session = c.get("session")!;

    await logoutUser(c, session.id);

    return c.json({}, 200);
});

UserRouter.post("/delete", async (c) => {
    const user = c.get("user")!;
    const session = c.get("session")!;

    // logout out the user
    await logoutUser(c, session.id);

    // delete the account
    await db.delete(usersTable).where(eq(usersTable.id, user.id));

    // remove reference to the user from match data
    await db
        .update(matchDataTable)
        .set({ userId: null })
        .where(eq(matchDataTable.userId, user.id));

    return c.json({}, 200);
});

UserRouter.post("/set_item_status", validateParams(zSetItemStatusRequest), async (c) => {
    const user = c.get("user")!;
    const { itemTypes, status } = c.req.valid("json");

    await db
        .update(itemsTable)
        .set({
            status: status,
        })
        .where(and(eq(itemsTable.userId, user.id), inArray(itemsTable.type, itemTypes)));

    return c.json({}, 200);
});

UserRouter.post("/get_market", async (c) => {
    const user = c.get("user")!;
    const market = await buildMarketState(user.id);

    return c.json<GetMarketResponse>(
        {
            success: true,
            gpBalance: user.gpBalance,
            listings: market.listings,
            userListings: market.userListings,
            soldListings: market.soldListings,
            expiredItemTypes: market.expiredItemTypes,
        },
        200,
    );
});

UserRouter.post(
    "/create_market_listing",
    validateParams(zCreateMarketListingRequest),
    async (c) => {
        const user = c.get("user")!;
        const { itemId, price } = c.req.valid("json");
        if (!Number.isInteger(price)) {
            return c.json<CreateMarketListingResponse>(
                { success: false, error: "invalid_price" },
                200,
            );
        }
        try {
            const result = await db.transaction(async (tx) => {
                await expireMarketListings(tx, user.id);

                const ownedItem = await tx.query.itemsTable.findFirst({
                    where: and(eq(itemsTable.userId, user.id), eq(itemsTable.id, itemId)),
                });

                if (!ownedItem) {
                    return { ok: false as const, error: "item_not_owned" as const };
                }

                const itemType = ownedItem.type;
                const priceBounds = getMarketPriceBounds(itemType);

                if (!isSupportedMarketItem(itemType) || !priceBounds) {
                    return { ok: false as const, error: "invalid_item" as const };
                }
                if (price < priceBounds.min) {
                    return { ok: false as const, error: "price_too_low" as const };
                }
                if (price > priceBounds.max) {
                    return { ok: false as const, error: "price_too_high" as const };
                }

                const existingListing = await tx.query.marketListingTable.findFirst({
                    where: and(
                        eq(marketListingTable.sellerUserId, user.id),
                        eq(marketListingTable.itemId, itemId),
                        eq(marketListingTable.status, "active"),
                    ),
                    columns: { id: true },
                });

                if (existingListing) {
                    return { ok: false as const, error: "already_listed" as const };
                }

                await tx.delete(itemsTable).where(eq(itemsTable.id, itemId));

                const remainingItems = await tx
                    .select({
                        id: itemsTable.id,
                        type: itemsTable.type,
                        timeAcquired: itemsTable.timeAcquired,
                        source: itemsTable.source,
                        status: itemsTable.status,
                    })
                    .from(itemsTable)
                    .where(eq(itemsTable.userId, user.id));

                await tx
                    .update(usersTable)
                    .set({
                        loadout: loadout.validateWithAvailableItems(
                            user.loadout,
                            remainingItems,
                        ),
                    })
                    .where(eq(usersTable.id, user.id));

                await tx.insert(marketListingTable).values({
                    sellerUserId: user.id,
                    itemId,
                    itemType,
                    price,
                    status: "active",
                });

                return { ok: true as const };
            });

            if (!result.ok) {
                return c.json<CreateMarketListingResponse>(
                    { success: false, error: result.error },
                    200,
                );
            }
        } catch (err) {
            server.logger.error("/api/user/create_market_listing error", err);
            return c.json<CreateMarketListingResponse>(
                { success: false, error: "server_error" },
                500,
            );
        }

        return c.json<CreateMarketListingResponse>(
            { success: true, gpBalance: user.gpBalance },
            200,
        );
    },
);

UserRouter.post(
    "/buy_market_listing",
    validateParams(zBuyMarketListingRequest),
    async (c) => {
        const user = c.get("user")!;
        const { listingId } = c.req.valid("json");

        try {
            const result = await db.transaction(async (tx) => {
                await expireMarketListings(tx, user.id);

                const listing = await tx.query.marketListingTable.findFirst({
                    where: and(
                        eq(marketListingTable.id, listingId),
                        eq(marketListingTable.status, "active"),
                    ),
                });

                if (!listing) {
                    return { ok: false as const, error: "listing_not_found" as const };
                }
                if (listing.sellerUserId === user.id) {
                    return {
                        ok: false as const,
                        error: "cannot_buy_own_listing" as const,
                    };
                }

                const buyer = await tx.query.usersTable.findFirst({
                    where: eq(usersTable.id, user.id),
                });
                if (!buyer || buyer.gpBalance < listing.price) {
                    return { ok: false as const, error: "not_enough_gp" as const };
                }

                const claimedListing = await tx
                    .update(marketListingTable)
                    .set({
                        status: "sold",
                        buyerUserId: user.id,
                        soldAt: new Date(),
                        sellerNotifiedAt: null,
                    })
                    .where(
                        and(
                            eq(marketListingTable.id, listingId),
                            eq(marketListingTable.status, "active"),
                        ),
                    )
                    .returning({ id: marketListingTable.id });

                if (claimedListing.length === 0) {
                    return { ok: false as const, error: "listing_not_found" as const };
                }

                await tx.insert(itemsTable).values({
                    id: listing.itemId,
                    userId: user.id,
                    type: listing.itemType,
                    source: "market_buy",
                    timeAcquired: Date.now(),
                });

                await tx
                    .update(usersTable)
                    .set({
                        gpBalance: buyer.gpBalance - listing.price,
                    })
                    .where(eq(usersTable.id, user.id));

                await tx
                    .update(usersTable)
                    .set({
                        gpBalance: sql`${usersTable.gpBalance} + ${listing.price}`,
                    })
                    .where(eq(usersTable.id, listing.sellerUserId));

                return {
                    ok: true as const,
                    gpBalance: buyer.gpBalance - listing.price,
                };
            });

            if (!result.ok) {
                return c.json<BuyMarketListingResponse>(
                    { success: false, error: result.error },
                    200,
                );
            }

            return c.json<BuyMarketListingResponse>(
                { success: true, gpBalance: result.gpBalance },
                200,
            );
        } catch (err) {
            server.logger.error("/api/user/buy_market_listing error", err);
            return c.json<BuyMarketListingResponse>(
                { success: false, error: "server_error" },
                500,
            );
        }
    },
);

UserRouter.post(
    "/ack_sold_market_listings",
    validateParams(zAckSoldMarketListingsRequest),
    async (c) => {
        const user = c.get("user")!;
        const { listingIds } = c.req.valid("json");

        if (listingIds.length > 0) {
            await db
                .update(marketListingTable)
                .set({
                    sellerNotifiedAt: new Date(),
                })
                .where(
                    and(
                        eq(marketListingTable.sellerUserId, user.id),
                        eq(marketListingTable.status, "sold"),
                        inArray(marketListingTable.id, listingIds),
                    ),
                );
        }

        return c.json<AckSoldMarketListingsResponse>({ success: true }, 200);
    },
);

UserRouter.post(
    "/cancel_market_listing",
    validateParams(zCancelMarketListingRequest),
    async (c) => {
        const user = c.get("user")!;
        const { listingId } = c.req.valid("json");

        try {
            const result = await db.transaction(async (tx) => {
                await expireMarketListings(tx, user.id);

                const canceled = await tx
                    .update(marketListingTable)
                    .set({
                        status: "cancelled",
                        canceledAt: new Date(),
                    })
                    .where(
                        and(
                            eq(marketListingTable.id, listingId),
                            eq(marketListingTable.sellerUserId, user.id),
                            eq(marketListingTable.status, "active"),
                        ),
                    )
                    .returning({
                        itemId: marketListingTable.itemId,
                        itemType: marketListingTable.itemType,
                    });

                if (canceled.length === 0) {
                    return { ok: false as const, error: "listing_not_found" as const };
                }

                await tx.insert(itemsTable).values({
                    id: canceled[0]!.itemId,
                    userId: user.id,
                    type: canceled[0]!.itemType,
                    source: "market_cancel",
                    timeAcquired: Date.now(),
                });

                return { ok: true as const };
            });

            if (!result.ok) {
                return c.json<CancelMarketListingResponse>(
                    { success: false, error: result.error },
                    200,
                );
            }
        } catch (err) {
            server.logger.error("/api/user/cancel_market_listing error", err);
            return c.json<CancelMarketListingResponse>(
                { success: false, error: "server_error" },
                500,
            );
        }

        return c.json<CancelMarketListingResponse>(
            { success: true, gpBalance: user.gpBalance },
            200,
        );
    },
);

UserRouter.post("/reset_stats", async (c) => {
    const user = c.get("user")!;

    await db
        .update(matchDataTable)
        .set({ userId: null })
        .where(eq(matchDataTable.userId, user.id));

    return c.json({}, 200);
});
