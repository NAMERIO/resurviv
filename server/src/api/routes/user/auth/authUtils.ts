import { generateRandomString } from "@oslojs/crypto/random";
import { and, eq, ne } from "drizzle-orm";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import slugify from "slugify";
import { UnlockDefs } from "../../../../../../shared/defs/gameObjects/unlockDefs";
import loadout, { ItemStatus } from "../../../../../../shared/utils/loadout";
import { util } from "../../../../../../shared/utils/util";
import { Config } from "../../../../config";
import { checkForBadWords } from "../../../../utils/serverHelpers";
import { createSession, invalidateSession, validateSessionToken } from "../../../auth";
import { db } from "../../../db";
import {
    auctionListingTable,
    itemsTable,
    marketListingTable,
    type UsersTableInsert,
    type UsersTableSelect,
    userAuthIdentityTable,
    usersTable,
} from "../../../db/schema";

let oauthBaseURL: URL | undefined = undefined;
if (URL.canParse(Config.oauthBasePath)) {
    oauthBaseURL = new URL(Config.oauthBasePath);
}
export const cookieDomain = oauthBaseURL?.hostname;

const discordServerTagRewardSource = "discord_server_tag";
const discordServerTagRewardItem = "outfitReTag";

type DiscordPrimaryGuild = {
    identity_guild_id?: string | null;
    identity_enabled?: boolean | null;
    tag?: string | null;
};

export type DiscordUserWithPrimaryGuild = {
    id: string;
    verified?: boolean;
    primary_guild?: DiscordPrimaryGuild | null;
};

function hasConfiguredDiscordServerTag(discordUser: DiscordUserWithPrimaryGuild) {
    const guildId = Config.discordServerTagGuildId ?? Config.discordGuildId;
    if (!guildId) return false;

    const primaryGuild = discordUser.primary_guild;
    return (
        primaryGuild?.identity_enabled === true &&
        primaryGuild.identity_guild_id === guildId
    );
}

async function fetchDiscordUser(discordId: string) {
    if (!Config.secrets.DISCORD_BOT_TOKEN) return undefined;

    const response = await fetch(`https://discord.com/api/users/${discordId}`, {
        headers: {
            Authorization: `Bot ${Config.secrets.DISCORD_BOT_TOKEN}`,
        },
    });

    if (response.status === 404) return null;
    if (!response.ok) return undefined;
    return (await response.json()) as DiscordUserWithPrimaryGuild;
}

async function removeDiscordServerTagReward(
    user: Pick<UsersTableSelect, "id" | "loadout">,
    tx: typeof db = db,
) {
    await tx
        .delete(itemsTable)
        .where(
            and(
                eq(itemsTable.userId, user.id),
                eq(itemsTable.type, discordServerTagRewardItem),
                eq(itemsTable.source, discordServerTagRewardSource),
            ),
        );

    await tx
        .update(marketListingTable)
        .set({ status: "canceled", canceledAt: new Date() })
        .where(
            and(
                eq(marketListingTable.sellerUserId, user.id),
                eq(marketListingTable.itemType, discordServerTagRewardItem),
                eq(marketListingTable.status, "active"),
            ),
        );

    await tx
        .update(auctionListingTable)
        .set({ status: "canceled", canceledAt: new Date() })
        .where(
            and(
                eq(auctionListingTable.sellerUserId, user.id),
                eq(auctionListingTable.itemType, discordServerTagRewardItem),
                eq(auctionListingTable.status, "active"),
            ),
        );

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
            loadout: loadout.validateWithAvailableItems(user.loadout, remainingItems),
        })
        .where(eq(usersTable.id, user.id));
}

export async function syncDiscordServerTagReward(
    user: Pick<UsersTableSelect, "id" | "loadout">,
    discordId?: string,
    discordUser?: DiscordUserWithPrimaryGuild,
) {
    if (!Config.discordServerTagGuildId && !Config.discordGuildId) return;

    if (!discordId) {
        await removeDiscordServerTagReward(user);
        return;
    }

    const userData = discordUser ?? (await fetchDiscordUser(discordId));
    if (userData === undefined) return;

    if (!userData || !hasConfiguredDiscordServerTag(userData)) {
        await removeDiscordServerTagReward(user);
        return;
    }

    const existing = await db.query.itemsTable.findFirst({
        where: and(
            eq(itemsTable.userId, user.id),
            eq(itemsTable.type, discordServerTagRewardItem),
            eq(itemsTable.source, discordServerTagRewardSource),
        ),
        columns: { id: true },
    });
    if (existing) return;

    await db.insert(itemsTable).values({
        userId: user.id,
        source: discordServerTagRewardSource,
        type: discordServerTagRewardItem,
        timeAcquired: Date.now(),
        status: ItemStatus.New,
    });
}

const random = {
    read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
    },
};
export function generateId(length: number) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    return generateRandomString(random, alphabet, length);
}

export function sanitizeSlug(username: string) {
    let slug = slugify(
        username
            .toLowerCase()
            .trim()
            .replace(/[\.,\?""!@#\$%\^&\*\(\)_=\+;:<>\/\\\|\}\{\[\]`~]/g, "-"),
        {
            trim: true,
            strict: true,
        },
    );

    if (!slug || checkForBadWords(slug)) {
        slug = `player_${generateId(6).toLowerCase()}`;
    }

    return slug;
}

export async function setSessionTokenCookie(userId: string, c: Context) {
    const sessionToken = crypto.randomUUID();
    const session = await createSession(sessionToken, userId);

    setCookie(c, "session", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: session.expiresAt,
        domain: cookieDomain,
    });
    return session;
}

export async function logoutUser(c: Context, sessionId: string) {
    await invalidateSession(sessionId);
    deleteSessionTokenCookie(c);
    deleteCookie(c, "app-data");
}

export function deleteSessionTokenCookie(c: Context) {
    setCookie(c, "session", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
        domain: cookieDomain,
    });
}

export type AuthProvider = "discord" | "google";

export type UserAuthState = {
    identities: Array<typeof userAuthIdentityTable.$inferSelect>;
    linked: boolean;
    linkedDiscord: boolean;
    linkedGoogle: boolean;
};

async function findLegacyIdentityOwner(provider: AuthProvider, authId: string) {
    const user = await db.query.usersTable.findFirst({
        where: and(
            eq(usersTable.authId, authId),
            provider === "discord"
                ? eq(usersTable.linkedDiscord, true)
                : eq(usersTable.linkedGoogle, true),
        ),
        columns: { id: true },
    });

    if (!user) return undefined;

    const existingIdentity = await db.query.userAuthIdentityTable.findFirst({
        where: and(
            eq(userAuthIdentityTable.provider, provider),
            eq(userAuthIdentityTable.authId, authId),
        ),
    });

    await db.transaction(async (tx) => {
        await tx
            .delete(userAuthIdentityTable)
            .where(
                and(
                    eq(userAuthIdentityTable.provider, provider),
                    eq(userAuthIdentityTable.authId, authId),
                    ne(userAuthIdentityTable.userId, user.id),
                ),
            );

        await tx
            .insert(userAuthIdentityTable)
            .values({
                provider,
                authId,
                userId: user.id,
            })
            .onConflictDoNothing();

        if (existingIdentity && existingIdentity.userId !== user.id) {
            await tx
                .update(usersTable)
                .set(
                    provider === "discord"
                        ? { linkedDiscord: false }
                        : { linkedGoogle: false },
                )
                .where(eq(usersTable.id, existingIdentity.userId));
        }

        await tx
            .update(usersTable)
            .set(
                provider === "discord"
                    ? { linked: true, linkedDiscord: true }
                    : { linked: true, linkedGoogle: true },
            )
            .where(eq(usersTable.id, user.id));
    });

    return db.query.userAuthIdentityTable.findFirst({
        where: and(
            eq(userAuthIdentityTable.provider, provider),
            eq(userAuthIdentityTable.authId, authId),
        ),
    });
}

async function findIdentityOwner(provider: AuthProvider, authId: string) {
    return (
        (await findLegacyIdentityOwner(provider, authId)) ??
        (await db.query.userAuthIdentityTable.findFirst({
            where: and(
                eq(userAuthIdentityTable.provider, provider),
                eq(userAuthIdentityTable.authId, authId),
            ),
        }))
    );
}

export async function ensureUserAuthIdentities(
    user: Pick<
        UsersTableSelect,
        "id" | "authId" | "linked" | "linkedDiscord" | "linkedGoogle"
    >,
): Promise<UserAuthState> {
    let identities = await db
        .select()
        .from(userAuthIdentityTable)
        .where(eq(userAuthIdentityTable.userId, user.id));

    const legacyProviders = [
        ...(user.linkedDiscord ? (["discord"] as const) : []),
        ...(user.linkedGoogle ? (["google"] as const) : []),
    ];
    const missingProviders = legacyProviders.filter(
        (provider) => !identities.some((identity) => identity.provider === provider),
    );
    const hasLegacyAuthIdentity = identities.some(
        (identity) => identity.authId === user.authId,
    );

    const providerToRepair =
        missingProviders.length === 1 &&
        (identities.length === 0 || !hasLegacyAuthIdentity)
            ? missingProviders[0]
            : undefined;

    if (providerToRepair) {
        await findLegacyIdentityOwner(providerToRepair, user.authId);

        identities = await db
            .select()
            .from(userAuthIdentityTable)
            .where(eq(userAuthIdentityTable.userId, user.id));
    }

    const hasIdentityRows = identities.length > 0;
    const linkedDiscord = hasIdentityRows
        ? identities.some((identity) => identity.provider === "discord")
        : user.linkedDiscord;
    const linkedGoogle = hasIdentityRows
        ? identities.some((identity) => identity.provider === "google")
        : user.linkedGoogle;
    const linked = linkedDiscord || linkedGoogle;

    if (
        user.linked !== linked ||
        user.linkedDiscord !== linkedDiscord ||
        user.linkedGoogle !== linkedGoogle
    ) {
        await db
            .update(usersTable)
            .set({ linked, linkedDiscord, linkedGoogle })
            .where(eq(usersTable.id, user.id));
    }

    return { identities, linked, linkedDiscord, linkedGoogle };
}

export async function handleAuthUser(
    c: Context,
    provider: AuthProvider,
    authId: string,
    options?: { linkAccount?: boolean },
) {
    const existingIdentity = await findIdentityOwner(provider, authId);
    const sessionToken = getCookie(c, "session");
    const currentUser = sessionToken
        ? (await validateSessionToken(sessionToken)).user
        : null;

    setCookie(c, "app-data", "1", {
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        domain: cookieDomain,
    });

    if (options?.linkAccount && !currentUser) {
        return { error: "link_login_required" };
    }

    if (currentUser) {
        await ensureUserAuthIdentities(currentUser);

        if (existingIdentity && existingIdentity.userId !== currentUser.id) {
            return { error: `${provider}_account_in_use` };
        }

        const currentProviderIdentity = await db.query.userAuthIdentityTable.findFirst({
            where: and(
                eq(userAuthIdentityTable.userId, currentUser.id),
                eq(userAuthIdentityTable.provider, provider),
            ),
        });

        if (currentProviderIdentity && currentProviderIdentity.authId !== authId) {
            return { error: `${provider}_account_in_use` };
        }

        if (!existingIdentity) {
            await db.insert(userAuthIdentityTable).values({
                userId: currentUser.id,
                provider,
                authId,
            });
        }

        await db
            .update(usersTable)
            .set(
                provider === "discord"
                    ? { linked: true, linkedDiscord: true }
                    : { linked: true, linkedGoogle: true },
            )
            .where(eq(usersTable.id, currentUser.id));

        await setSessionTokenCookie(currentUser.id, c);
        return { user: currentUser };
    }

    if (existingIdentity) {
        await setSessionTokenCookie(existingIdentity.userId, c);
        const user = await db.query.usersTable.findFirst({
            where: eq(usersTable.id, existingIdentity.userId),
        });
        return { user };
    }

    let generateUsername = true;

    let username = "";
    let slug = "";

    while (generateUsername) {
        username = `Player ${generateId(6)}`;
        slug = sanitizeSlug(username);

        const slugTaken = await db.query.usersTable.findFirst({
            where: eq(usersTable.slug, slug),
            columns: {
                id: true,
            },
        });
        generateUsername = !!slugTaken;
    }

    const linkedProvider =
        provider === "discord" ? { linkedDiscord: true } : { linkedGoogle: true };

    const userId = generateId(15);
    await createNewUser(
        {
            id: userId,
            authId,
            linked: true,
            username: username,
            slug,
            ...linkedProvider,
        },
        { provider, authId },
    );

    await setSessionTokenCookie(userId, c);
    const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, userId),
    });
    return { user };
}

export async function createNewUser(
    payload: UsersTableInsert,
    identity?: { provider: AuthProvider; authId: string },
) {
    await db.transaction(async (tx) => {
        await tx.insert(usersTable).values(payload);
        if (identity) {
            await tx.insert(userAuthIdentityTable).values({
                ...identity,
                userId: payload.id,
            });
        }

        const unlockType = "unlock_new_account";
        const itemsToUnlock = UnlockDefs[unlockType].unlocks || [];

        if (!itemsToUnlock.length) return;

        const items = itemsToUnlock.map((outfit) => {
            return {
                userId: payload.id,
                source: unlockType,
                type: outfit,
                timeAcquired: Date.now(),
            };
        });

        await tx.insert(itemsTable).values(items);
    });
}

export function getRedirectUri(method: AuthProvider) {
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && !Config.oauthRedirectURI) {
        throw new Error("oauthRedirectURI is not defined.");
    }

    return `${Config.oauthRedirectURI}/api/auth/${method}/callback`;
}

export function getOAuthRedirect(error?: string) {
    if (!error) return Config.oauthBasePath;

    const separator = Config.oauthBasePath.includes("?") ? "&" : "?";
    return `${Config.oauthBasePath}${separator}error=${encodeURIComponent(error)}`;
}

const cooldownPeriod = util.daysToMs(10);

export function getTimeUntilNextUsernameChange(lastChangeTime: Date | null) {
    if (!(lastChangeTime instanceof Date)) return 0;

    const currentTime = Date.now();
    const timeSinceLastChange = currentTime - new Date(lastChangeTime).getTime();
    return cooldownPeriod - timeSinceLastChange;
}
