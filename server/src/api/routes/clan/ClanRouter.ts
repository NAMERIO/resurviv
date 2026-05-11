import { and, asc, count, desc, eq, gt, lt, sql } from "drizzle-orm";
import { Hono } from "hono";
import slugify from "slugify";
import {
    ClanConstants,
    type ClanDetail,
    type ClanInfo,
    type ClanLeaderboardResponse,
    type ClanMember,
    type ClanMessage,
    ClanTagColorRegex,
    type CreateClanResponse,
    type DeleteClanMessageResponse,
    type DeleteClanResponse,
    type EditClanMessageResponse,
    type GetClanMessagesResponse,
    type GetClanResponse,
    type GetMyClanResponse,
    type JoinClanResponse,
    type KickMemberResponse,
    type KlipyGifPickerItem,
    type LeaveClanResponse,
    type ListClansResponse,
    type ResolveKlipyGifResponse,
    type SearchKlipyGifsResponse,
    type SendClanMessageResponse,
    type TransferOwnershipResponse,
    type UpdateClanResponse,
    zClanLeaderboardRequest,
    zCreateClanRequest,
    zDeleteClanMessageRequest,
    zEditClanMessageRequest,
    zGetClanMessagesRequest,
    zGetClanRequest,
    zJoinClanRequest,
    zKickMemberRequest,
    zListClansRequest,
    zResolveKlipyGifRequest,
    zSearchKlipyGifsRequest,
    zSendClanMessageRequest,
    zTransferOwnershipRequest,
    zUpdateClanRequest,
} from "../../../../../shared/types/clan";
import { Config } from "../../../config";
import {
    checkForBadWords,
    getHonoIp,
    validateUserName,
} from "../../../utils/serverHelpers";
import {
    authMiddleware,
    databaseEnabledMiddleware,
    rateLimitMiddleware,
    validateParams,
} from "../../auth/middleware";
import { db } from "../../db";
import {
    clanLeaveHistoryTable,
    clanMemberStatsTable,
    clanMembersTable,
    clanMessagesTable,
    clansTable,
    usersTable,
} from "../../db/schema";
import type { Context } from "../../index";

export const ClanRouter = new Hono<Context>();

ClanRouter.use(databaseEnabledMiddleware);
ClanRouter.use(rateLimitMiddleware(60, 60 * 1000));
ClanRouter.use(authMiddleware);

const CLAN_SYSTEM_AUTHOR_NAME = "Big Brother";
const CLAN_SYSTEM_AUTHOR_SLUG = "big-brother";
const CLAN_SYSTEM_AUTHOR_ICON = "emote_police";

function sanitizeClanSlug(name: string): string {
    let slug = slugify(
        name
            .toLowerCase()
            .trim()
            .replace(/[\.,\?""!@#\$%\^&\*\(\)_=\+;:<>\/\\\|\}\{\[\]`~]/g, "-"),
        { trim: true, strict: true },
    );

    if (!slug || checkForBadWords(slug)) {
        slug = `clan_${crypto.randomUUID().slice(0, 8)}`;
    }
    return slug;
}

function sanitizeClanTagColor(color: string | null | undefined): string {
    const normalized = (color ?? "").trim();
    if (!normalized || !ClanTagColorRegex.test(normalized)) {
        return "";
    }
    return normalized;
}

async function pruneClanMessages(clanId: string) {
    await db
        .delete(clanMessagesTable)
        .where(
            and(
                eq(clanMessagesTable.clanId, clanId),
                lt(clanMessagesTable.createdAt, sql<Date>`NOW() - INTERVAL '1 month'`),
            ),
        );

    await db.execute(sql`
        DELETE FROM clan_messages
        WHERE clan_id = ${clanId}
        AND id NOT IN (
            SELECT id
            FROM clan_messages
            WHERE clan_id = ${clanId}
            ORDER BY created_at DESC, id DESC
            LIMIT 100
        )
    `);
}

async function createClanSystemMessage(
    clanId: string,
    userId: string,
    type: "member_join" | "member_leave",
    message: string,
) {
    await db.insert(clanMessagesTable).values({
        clanId,
        userId,
        type,
        message,
    });
    await pruneClanMessages(clanId);
}

function getUserMembership(userId: string) {
    return db.query.clanMembersTable.findFirst({
        where: eq(clanMembersTable.userId, userId),
    });
}

type KlipyGifResult = {
    id?: string;
    url: string;
    sourceUrl: string;
    title: string;
    width: number | null;
    height: number | null;
};

type KlipyApiGifObject = {
    id?: string;
    type?: string;
    content_type?: string;
    is_ad?: boolean;
    ad?: unknown;
    html?: string;
    html_content?: string;
    iframe?: string;
    iframe_url?: string;
    image?: string;
    image_url?: string;
    click_url?: string;
    target_url?: string;
    width?: number;
    height?: number;
    title?: string;
    itemurl?: string;
    url?: string;
    media_formats?: {
        gif?: { url?: string; dims?: [number, number] };
        mediumgif?: { url?: string; dims?: [number, number] };
        tinygif?: { url?: string; dims?: [number, number] };
    };
};

type KlipyAdResult = Extract<KlipyGifPickerItem, { type: "ad" }>;

function parseKlipyUrl(rawUrl: string): URL | null {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return null;
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
        return null;
    }

    const hostname = url.hostname.toLowerCase();
    if (hostname !== "klipy.com" && !hostname.endsWith(".klipy.com")) {
        return null;
    }

    return url;
}

function getKlipyGifId(url: URL): string | null {
    const segments = url.pathname.split("/").filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i--) {
        const segment = decodeURIComponent(segments[i]);
        const match = segment.match(/(?:^|[-_])([a-zA-Z0-9]{6,})(?:\.[a-z0-9]+)?$/);
        if (match) return match[1];
    }
    return null;
}

function isKlipyMediaUrl(url: URL) {
    const hostname = url.hostname.toLowerCase();
    return (
        (hostname === "klipy.com" || hostname.endsWith(".klipy.com")) &&
        /\.(gif|webp|mp4)$/i.test(url.pathname)
    );
}

function normalizeKlipyMediaUrl(rawUrl: string): string | null {
    const url = parseKlipyUrl(rawUrl);
    if (!url || !isKlipyMediaUrl(url)) return null;
    url.protocol = "https:";
    url.search = "";
    return url.toString();
}

function getMetaContent(html: string, key: string) {
    const metaRegex = /<meta\s+([^>]+)>/gi;
    let match: RegExpExecArray | null;
    while ((match = metaRegex.exec(html))) {
        const tag = match[1];
        if (!new RegExp(`(?:property|name)=["']${key}["']`, "i").test(tag)) {
            continue;
        }

        const contentMatch = tag.match(/content=["']([^"']+)["']/i);
        if (contentMatch) return contentMatch[1];
    }
    return null;
}

function toKlipyGifResult(result: KlipyApiGifObject): KlipyGifResult | null {
    const gif =
        result.media_formats?.gif ??
        result.media_formats?.mediumgif ??
        result.media_formats?.tinygif;
    if (!gif?.url) return null;

    return {
        id: result.id,
        url: gif.url,
        sourceUrl: result.url || result.itemurl || gif.url,
        title: result.title || "Klipy GIF",
        width: gif.dims?.[0] ?? null,
        height: gif.dims?.[1] ?? null,
    };
}

function getKlipyAdObject(result: KlipyApiGifObject): Record<string, unknown> | null {
    const nestedAd = result.ad;
    if (nestedAd && typeof nestedAd === "object") {
        return nestedAd as Record<string, unknown>;
    }

    const type = String(result.type || result.content_type || "").toLowerCase();
    if (
        result.is_ad ||
        type.includes("ad") ||
        result.html ||
        result.html_content ||
        result.iframe ||
        result.iframe_url
    ) {
        return result as Record<string, unknown>;
    }

    return null;
}

function getStringValue(source: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = source[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return null;
}

function getNumberValue(source: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = source[key];
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
            return Number(value);
        }
    }
    return null;
}

function normalizeKlipyExternalUrl(rawUrl: string | null) {
    if (!rawUrl) return null;
    try {
        const url = new URL(rawUrl);
        if (url.protocol !== "https:" && url.protocol !== "http:") {
            return null;
        }
        return url.toString();
    } catch {
        return null;
    }
}

function toKlipyAdResult(result: KlipyApiGifObject): KlipyAdResult | null {
    const ad = getKlipyAdObject(result);
    if (!ad) return null;

    const html = getStringValue(ad, ["html", "html_content", "markup", "ad_html"]);
    const iframeUrl = normalizeKlipyExternalUrl(
        getStringValue(ad, ["iframe_url", "iframeUrl", "iframe", "ad_url"]),
    );
    const imageUrl = normalizeKlipyExternalUrl(
        getStringValue(ad, ["image_url", "imageUrl", "image", "thumbnail", "thumbnail_url"]),
    );
    const clickUrl = normalizeKlipyExternalUrl(
        getStringValue(ad, ["click_url", "clickUrl", "target_url", "targetUrl", "url"]),
    );

    if (!html && !iframeUrl && !imageUrl) return null;

    return {
        type: "ad",
        id:
            result.id ||
            getStringValue(ad, ["id", "ad_id", "creative_id"]) ||
            `klipy-ad-${Math.random().toString(36).slice(2)}`,
        title: getStringValue(ad, ["title", "name"]) || "Advertisement",
        html,
        iframeUrl,
        imageUrl,
        clickUrl,
        width: getNumberValue(ad, ["width", "w"]) ?? null,
        height: getNumberValue(ad, ["height", "h"]) ?? null,
    };
}

async function fetchKlipyApiGif(id: string): Promise<KlipyGifResult | null> {
    const apiKey = Config.secrets.KLIPY_API_KEY;
    if (!apiKey) return null;

    const params = new URLSearchParams({
        key: apiKey,
        ids: id,
        media_filter: "gif,tinygif,mediumgif",
    });
    const res = await fetch(`https://api.klipy.com/v2/posts?${params}`, {
        signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { results?: KlipyApiGifObject[] };
    const result = data.results?.[0];
    return result ? toKlipyGifResult(result) : null;
}

async function fetchKlipyGifPickerItems(options: {
    query?: string;
    section?: string;
    limit: number;
    customerId: string;
    adMaxWidth?: number;
    adMaxHeight?: number;
    userAgent?: string;
    ip?: string;
}): Promise<KlipyGifPickerItem[]> {
    const apiKey = Config.secrets.KLIPY_API_KEY;
    if (!apiKey) return [];

    const query = options.query || options.section || "";
    const endpoint = query ? "search" : "featured";
    const params = new URLSearchParams({
        key: apiKey,
        limit: String(options.limit),
        media_filter: "gif,tinygif,mediumgif",
        customer_id: options.customerId,
        "ad-min-width": "50",
        "ad-max-width": String(options.adMaxWidth || 401),
        "ad-min-height": "50",
        "ad-max-height": String(options.adMaxHeight || 250),
    });
    if (query) {
        params.set("q", query);
    }

    const headers = new Headers();
    if (options.userAgent) {
        headers.set("User-Agent", options.userAgent);
    }
    if (options.ip) {
        headers.set("X-Forwarded-For", options.ip);
    }

    const res = await fetch(`https://api.klipy.com/v2/${endpoint}?${params}`, {
        headers,
        signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { results?: KlipyApiGifObject[] };
    return (data.results || [])
        .map((result) => {
            const ad = toKlipyAdResult(result);
            if (ad) return ad;

            const gif = toKlipyGifResult(result);
            if (!gif) return null;
            return {
                type: "gif" as const,
                id: gif.id || gif.sourceUrl,
                url: gif.url,
                sourceUrl: gif.sourceUrl,
                title: gif.title,
                width: gif.width,
                height: gif.height,
            };
        })
        .filter((gif): gif is KlipyGifPickerItem => !!gif);
}

async function fetchKlipyPageGif(url: URL): Promise<KlipyGifResult | null> {
    const res = await fetch(url.toString(), {
        headers: {
            "User-Agent": "resurviv-clan-chat/1.0",
        },
        signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    const image = getMetaContent(html, "og:image");
    const imageUrl = image ? normalizeKlipyMediaUrl(image) : null;
    if (!imageUrl) return null;

    const title = getMetaContent(html, "og:title");
    return {
        url: imageUrl,
        sourceUrl: url.toString(),
        title: title || "Klipy GIF",
        width: null,
        height: null,
    };
}

async function resolveKlipyGif(rawUrl: string): Promise<KlipyGifResult | null> {
    const url = parseKlipyUrl(rawUrl);
    if (!url) return null;

    const directMediaUrl = normalizeKlipyMediaUrl(url.toString());
    if (directMediaUrl) {
        return {
            url: directMediaUrl,
            sourceUrl: url.toString(),
            title: "Klipy GIF",
            width: null,
            height: null,
        };
    }

    const gifId = getKlipyGifId(url);
    if (gifId) {
        const apiGif = await fetchKlipyApiGif(gifId);
        if (apiGif) return apiGif;
    }

    return fetchKlipyPageGif(url);
}

function toClanMessage(row: {
    id: string;
    clanId: string;
    senderId: string;
    type: "user" | "member_join" | "member_leave";
    username: string;
    slug: string;
    playerIcon: string | null;
    message: string;
    createdAt: Date;
    editedAt: Date | null;
    replyToId: string | null;
    replyToUsername: string | null;
    replyToMessage: string | null;
}): ClanMessage {
    const isSystemMessage = row.type !== "user";

    return {
        id: row.id,
        clanId: row.clanId,
        senderId: row.senderId,
        type: row.type,
        username: isSystemMessage ? CLAN_SYSTEM_AUTHOR_NAME : row.username,
        slug: isSystemMessage ? CLAN_SYSTEM_AUTHOR_SLUG : row.slug,
        playerIcon: isSystemMessage
            ? CLAN_SYSTEM_AUTHOR_ICON
            : row.playerIcon || "emote_surviv",
        message: row.message,
        createdAt: row.createdAt.getTime(),
        editedAt: row.editedAt?.getTime() ?? null,
        replyTo:
            row.replyToId && row.replyToUsername && row.replyToMessage
                ? {
                      id: row.replyToId,
                      username: row.replyToUsername,
                      message: row.replyToMessage,
                  }
                : null,
    };
}

async function getClanMessageById(messageId: string) {
    const rows = await db
        .select({
            id: clanMessagesTable.id,
            clanId: clanMessagesTable.clanId,
            senderId: usersTable.id,
            type: clanMessagesTable.type,
            username: usersTable.username,
            slug: usersTable.slug,
            playerIcon: sql<string>`${usersTable.loadout}->>'player_icon'`,
            message: clanMessagesTable.message,
            createdAt: clanMessagesTable.createdAt,
            editedAt: clanMessagesTable.editedAt,
            replyToId: clanMessagesTable.replyToMessageId,
            replyToUsername: sql<string | null>`(
                SELECT users.username
                FROM clan_messages reply_messages
                INNER JOIN users ON users.id = reply_messages.user_id
                WHERE reply_messages.id = ${clanMessagesTable.replyToMessageId}
                LIMIT 1
            )`,
            replyToMessage: sql<string | null>`(
                SELECT reply_messages.message
                FROM clan_messages reply_messages
                WHERE reply_messages.id = ${clanMessagesTable.replyToMessageId}
                LIMIT 1
            )`,
        })
        .from(clanMessagesTable)
        .innerJoin(usersTable, eq(usersTable.id, clanMessagesTable.userId))
        .where(eq(clanMessagesTable.id, messageId))
        .limit(1);

    return rows[0] ? toClanMessage(rows[0]) : null;
}

async function getClanInfo(clanId: string): Promise<ClanInfo | null> {
    const clan = await db.query.clansTable.findFirst({
        where: eq(clansTable.id, clanId),
    });

    if (!clan) return null;

    const memberCountResult = await db
        .select({ count: count() })
        .from(clanMembersTable)
        .where(eq(clanMembersTable.clanId, clanId));

    const statsResult = await db
        .select({
            totalKills: sql<number>`COALESCE(SUM(${clanMemberStatsTable.kills}), 0)`,
            totalWins: sql<number>`COALESCE(SUM(${clanMemberStatsTable.wins}), 0)`,
        })
        .from(clanMemberStatsTable)
        .where(eq(clanMemberStatsTable.clanId, clanId));

    return {
        id: clan.id,
        name: clan.name,
        icon: clan.icon,
        tagColor: clan.tagColor,
        ownerId: clan.ownerId,
        memberCount: memberCountResult[0]?.count || 0,
        maxMembers: ClanConstants.MaxMembers,
        createdAt: clan.createdAt.getTime(),
        totalKills: statsResult[0]?.totalKills || 0,
        totalWins: statsResult[0]?.totalWins || 0,
    };
}

async function getClanDetail(clanId: string): Promise<ClanDetail | null> {
    const clanInfo = await getClanInfo(clanId);
    if (!clanInfo) return null;

    const membersData = await db
        .select({
            odUserId: usersTable.id,
            username: usersTable.username,
            slug: usersTable.slug,
            playerIcon: sql<string>`${usersTable.loadout}->>'player_icon'`,
            joinedAt: clanMembersTable.joinedAt,
            kills: sql<number>`COALESCE((
                SELECT SUM(kills) FROM clan_member_stats
                WHERE clan_member_stats.clan_id = ${clanMembersTable.clanId}
                AND clan_member_stats.user_id = ${clanMembersTable.userId}
            ), 0)`,
            wins: sql<number>`COALESCE((
                SELECT SUM(wins) FROM clan_member_stats
                WHERE clan_member_stats.clan_id = ${clanMembersTable.clanId}
                AND clan_member_stats.user_id = ${clanMembersTable.userId}
            ), 0)`,
        })
        .from(clanMembersTable)
        .innerJoin(usersTable, eq(usersTable.id, clanMembersTable.userId))
        .where(eq(clanMembersTable.clanId, clanId));

    const members: ClanMember[] = membersData.map((m) => ({
        odUserId: m.odUserId,
        username: m.username,
        slug: m.slug,
        playerIcon: m.playerIcon || "emote_surviv",
        joinedAt: m.joinedAt.getTime(),
        isOwner: m.odUserId === clanInfo.ownerId,
        statsAfterJoin: {
            kills: m.kills || 0,
            wins: m.wins || 0,
        },
    }));

    return {
        ...clanInfo,
        members,
    };
}

ClanRouter.post("/my_clan", async (c) => {
    const user = c.get("user")!;

    const membership = await db.query.clanMembersTable.findFirst({
        where: eq(clanMembersTable.userId, user.id),
    });

    const lastLeave = await db.query.clanLeaveHistoryTable.findFirst({
        where: eq(clanLeaveHistoryTable.userId, user.id),
        orderBy: desc(clanLeaveHistoryTable.leftAt),
    });

    const cooldownUntil = lastLeave
        ? lastLeave.leftAt.getTime() + ClanConstants.RejoinCooldownMs
        : null;

    if (!membership) {
        return c.json<GetMyClanResponse>({
            success: true,
            clan: null,
            cooldownUntil:
                cooldownUntil && cooldownUntil > Date.now() ? cooldownUntil : null,
        });
    }

    const clan = await getClanDetail(membership.clanId);

    return c.json<GetMyClanResponse>({
        success: true,
        clan,
        cooldownUntil: cooldownUntil && cooldownUntil > Date.now() ? cooldownUntil : null,
    });
});

ClanRouter.post("/create", validateParams(zCreateClanRequest), async (c) => {
    const user = c.get("user")!;
    const { name, icon, tagColor } = c.req.valid("json");

    const existingMembership = await db.query.clanMembersTable.findFirst({
        where: eq(clanMembersTable.userId, user.id),
    });

    if (existingMembership) {
        return c.json<CreateClanResponse>(
            { success: false, error: "already_in_clan" },
            400,
        );
    }

    const { validName, originalWasInvalid } = validateUserName(name);
    if (originalWasInvalid) {
        return c.json<CreateClanResponse>({ success: false, error: "invalid_name" }, 400);
    }

    const slug = sanitizeClanSlug(validName);
    const existingClan = await db.query.clansTable.findFirst({
        where: eq(clansTable.slug, slug),
    });

    if (existingClan) {
        return c.json<CreateClanResponse>({ success: false, error: "name_taken" }, 400);
    }

    const [newClan] = await db
        .insert(clansTable)
        .values({
            name: validName,
            slug,
            icon,
            tagColor: sanitizeClanTagColor(tagColor),
            ownerId: user.id,
        })
        .returning();

    await db.insert(clanMembersTable).values({
        clanId: newClan.id,
        userId: user.id,
    });

    await db.insert(clanMemberStatsTable).values({
        clanId: newClan.id,
        userId: user.id,
        kills: 0,
        wins: 0,
    });

    const clanInfo = await getClanInfo(newClan.id);

    return c.json<CreateClanResponse>({ success: true, clan: clanInfo! }, 201);
});

ClanRouter.post("/join", validateParams(zJoinClanRequest), async (c) => {
    const user = c.get("user")!;
    const { clanId } = c.req.valid("json");

    const existingMembership = await db.query.clanMembersTable.findFirst({
        where: eq(clanMembersTable.userId, user.id),
    });

    if (existingMembership) {
        return c.json<JoinClanResponse>(
            { success: false, error: "already_in_clan" },
            400,
        );
    }

    const lastLeave = await db.query.clanLeaveHistoryTable.findFirst({
        where: eq(clanLeaveHistoryTable.userId, user.id),
        orderBy: desc(clanLeaveHistoryTable.leftAt),
    });

    if (lastLeave) {
        const cooldownEnd = lastLeave.leftAt.getTime() + ClanConstants.RejoinCooldownMs;
        if (Date.now() < cooldownEnd) {
            return c.json<JoinClanResponse>(
                {
                    success: false,
                    error: "cooldown_active",
                    cooldownRemaining: cooldownEnd - Date.now(),
                },
                400,
            );
        }
    }

    const clan = await db.query.clansTable.findFirst({
        where: eq(clansTable.id, clanId),
    });

    if (!clan) {
        return c.json<JoinClanResponse>({ success: false, error: "clan_not_found" }, 404);
    }

    const memberCount = await db
        .select({ count: count() })
        .from(clanMembersTable)
        .where(eq(clanMembersTable.clanId, clanId));

    if ((memberCount[0]?.count || 0) >= ClanConstants.MaxMembers) {
        return c.json<JoinClanResponse>({ success: false, error: "clan_full" }, 400);
    }

    await db.insert(clanMembersTable).values({
        clanId,
        userId: user.id,
    });

    await db.insert(clanMemberStatsTable).values({
        clanId,
        userId: user.id,
        kills: 0,
        wins: 0,
    });

    await createClanSystemMessage(
        clanId,
        user.id,
        "member_join",
        `${user.username} joined the clan.`,
    );

    const clanInfo = await getClanInfo(clanId);

    return c.json<JoinClanResponse>({ success: true, clan: clanInfo! });
});

ClanRouter.post("/leave", async (c) => {
    const user = c.get("user")!;

    const membership = await db.query.clanMembersTable.findFirst({
        where: eq(clanMembersTable.userId, user.id),
    });

    if (!membership) {
        return c.json<LeaveClanResponse>({ success: false, error: "not_in_clan" }, 400);
    }

    const clan = await db.query.clansTable.findFirst({
        where: eq(clansTable.id, membership.clanId),
    });

    if (clan && clan.ownerId === user.id) {
        return c.json<LeaveClanResponse>(
            { success: false, error: "owner_cannot_leave" },
            400,
        );
    }

    await db
        .delete(clanMembersTable)
        .where(
            and(
                eq(clanMembersTable.clanId, membership.clanId),
                eq(clanMembersTable.userId, user.id),
            ),
        );

    await db
        .delete(clanMemberStatsTable)
        .where(
            and(
                eq(clanMemberStatsTable.clanId, membership.clanId),
                eq(clanMemberStatsTable.userId, user.id),
            ),
        );

    await db.insert(clanLeaveHistoryTable).values({
        userId: user.id,
    });

    await createClanSystemMessage(
        membership.clanId,
        user.id,
        "member_leave",
        `${user.username} left the clan.`,
    );

    return c.json<LeaveClanResponse>({ success: true });
});

ClanRouter.post("/kick", validateParams(zKickMemberRequest), async (c) => {
    const user = c.get("user")!;
    const { memberId } = c.req.valid("json");

    const membership = await db.query.clanMembersTable.findFirst({
        where: eq(clanMembersTable.userId, user.id),
    });

    if (!membership) {
        return c.json<KickMemberResponse>({ success: false, error: "not_owner" }, 403);
    }

    const clan = await db.query.clansTable.findFirst({
        where: eq(clansTable.id, membership.clanId),
    });

    if (!clan || clan.ownerId !== user.id) {
        return c.json<KickMemberResponse>({ success: false, error: "not_owner" }, 403);
    }

    if (memberId === user.id) {
        return c.json<KickMemberResponse>(
            { success: false, error: "cannot_kick_self" },
            400,
        );
    }

    const memberToKick = await db.query.clanMembersTable.findFirst({
        where: and(
            eq(clanMembersTable.clanId, clan.id),
            eq(clanMembersTable.userId, memberId),
        ),
    });

    if (!memberToKick) {
        return c.json<KickMemberResponse>(
            { success: false, error: "member_not_found" },
            404,
        );
    }

    const kickedUser = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, memberId),
    });

    await db
        .delete(clanMembersTable)
        .where(
            and(
                eq(clanMembersTable.clanId, clan.id),
                eq(clanMembersTable.userId, memberId),
            ),
        );

    // Remove the kicked player's stats for this clan so they don't get duplicated on rejoin
    await db
        .delete(clanMemberStatsTable)
        .where(
            and(
                eq(clanMemberStatsTable.clanId, clan.id),
                eq(clanMemberStatsTable.userId, memberId),
            ),
        );

    await db.insert(clanLeaveHistoryTable).values({
        userId: memberId,
    });

    await createClanSystemMessage(
        clan.id,
        memberId,
        "member_leave",
        `${kickedUser?.username || "A member"} left the clan.`,
    );

    return c.json<KickMemberResponse>({ success: true });
});

ClanRouter.post("/transfer", validateParams(zTransferOwnershipRequest), async (c) => {
    const user = c.get("user")!;
    const { newOwnerId } = c.req.valid("json");

    const membership = await db.query.clanMembersTable.findFirst({
        where: eq(clanMembersTable.userId, user.id),
    });

    if (!membership) {
        return c.json<TransferOwnershipResponse>(
            { success: false, error: "not_owner" },
            403,
        );
    }

    const clan = await db.query.clansTable.findFirst({
        where: eq(clansTable.id, membership.clanId),
    });

    if (!clan || clan.ownerId !== user.id) {
        return c.json<TransferOwnershipResponse>(
            { success: false, error: "not_owner" },
            403,
        );
    }

    const newOwnerMembership = await db.query.clanMembersTable.findFirst({
        where: and(
            eq(clanMembersTable.clanId, clan.id),
            eq(clanMembersTable.userId, newOwnerId),
        ),
    });

    if (!newOwnerMembership) {
        return c.json<TransferOwnershipResponse>(
            { success: false, error: "member_not_found" },
            404,
        );
    }

    await db
        .update(clansTable)
        .set({ ownerId: newOwnerId })
        .where(eq(clansTable.id, clan.id));

    return c.json<TransferOwnershipResponse>({ success: true });
});

ClanRouter.post("/update", validateParams(zUpdateClanRequest), async (c) => {
    const user = c.get("user")!;
    const { name, icon, tagColor } = c.req.valid("json");

    const membership = await db.query.clanMembersTable.findFirst({
        where: eq(clanMembersTable.userId, user.id),
    });

    if (!membership) {
        return c.json<UpdateClanResponse>({ success: false, error: "not_owner" }, 403);
    }

    const clan = await db.query.clansTable.findFirst({
        where: eq(clansTable.id, membership.clanId),
    });

    if (!clan || clan.ownerId !== user.id) {
        return c.json<UpdateClanResponse>({ success: false, error: "not_owner" }, 403);
    }

    const updates: Partial<{
        name: string;
        slug: string;
        icon: string;
        tagColor: string;
    }> = {};

    if (name && name !== clan.name) {
        const { validName, originalWasInvalid } = validateUserName(name);
        if (originalWasInvalid) {
            return c.json<UpdateClanResponse>(
                { success: false, error: "invalid_name" },
                400,
            );
        }

        const slug = sanitizeClanSlug(validName);

        const existingClan = await db.query.clansTable.findFirst({
            where: and(eq(clansTable.slug, slug), sql`${clansTable.id} != ${clan.id}`),
        });

        if (existingClan) {
            return c.json<UpdateClanResponse>(
                { success: false, error: "name_taken" },
                400,
            );
        }

        updates.name = validName;
        updates.slug = slug;
    }

    if (icon && icon !== clan.icon) {
        updates.icon = icon;
    }

    if (tagColor !== undefined) {
        const sanitizedTagColor = sanitizeClanTagColor(tagColor);
        if (sanitizedTagColor !== clan.tagColor) {
            updates.tagColor = sanitizedTagColor;
        }
    }

    if (Object.keys(updates).length > 0) {
        await db.update(clansTable).set(updates).where(eq(clansTable.id, clan.id));
    }

    const updatedClan = await getClanDetail(clan.id);

    return c.json<UpdateClanResponse>({ success: true, clan: updatedClan! });
});

ClanRouter.post("/delete", async (c) => {
    const user = c.get("user")!;

    const membership = await db.query.clanMembersTable.findFirst({
        where: eq(clanMembersTable.userId, user.id),
    });

    if (!membership) {
        return c.json<DeleteClanResponse>({ success: false, error: "not_owner" }, 403);
    }

    const clan = await db.query.clansTable.findFirst({
        where: eq(clansTable.id, membership.clanId),
    });

    if (!clan || clan.ownerId !== user.id) {
        return c.json<DeleteClanResponse>({ success: false, error: "not_owner" }, 403);
    }

    const members = await db
        .select({ userId: clanMembersTable.userId })
        .from(clanMembersTable)
        .where(eq(clanMembersTable.clanId, clan.id));

    await db.delete(clansTable).where(eq(clansTable.id, clan.id));

    for (const member of members) {
        await db.insert(clanLeaveHistoryTable).values({
            userId: member.userId,
        });
    }

    return c.json<DeleteClanResponse>({ success: true });
});

ClanRouter.post("/get", validateParams(zGetClanRequest), async (c) => {
    const { clanId } = c.req.valid("json");

    const clan = await getClanDetail(clanId);

    if (!clan) {
        return c.json<GetClanResponse>({ success: false, error: "clan_not_found" }, 404);
    }

    return c.json<GetClanResponse>({ success: true, clan });
});

ClanRouter.post("/messages", validateParams(zGetClanMessagesRequest), async (c) => {
    const user = c.get("user")!;
    const { clanId, after, before, limit } = c.req.valid("json");

    const membership = await getUserMembership(user.id);
    if (!membership || membership.clanId !== clanId) {
        return c.json<GetClanMessagesResponse>(
            { success: false, error: "not_in_clan" },
            403,
        );
    }

    await pruneClanMessages(clanId);

    const afterDate = after ? new Date(after) : null;
    const beforeDate = before ? new Date(before) : null;
    const timeFilter = afterDate
        ? gt(clanMessagesTable.createdAt, afterDate)
        : beforeDate
          ? lt(clanMessagesTable.createdAt, beforeDate)
          : undefined;

    const rows = await db
        .select({
            id: clanMessagesTable.id,
            clanId: clanMessagesTable.clanId,
            senderId: usersTable.id,
            type: clanMessagesTable.type,
            username: usersTable.username,
            slug: usersTable.slug,
            playerIcon: sql<string>`${usersTable.loadout}->>'player_icon'`,
            message: clanMessagesTable.message,
            createdAt: clanMessagesTable.createdAt,
            editedAt: clanMessagesTable.editedAt,
            replyToId: clanMessagesTable.replyToMessageId,
            replyToUsername: sql<string | null>`(
                SELECT users.username
                FROM clan_messages reply_messages
                INNER JOIN users ON users.id = reply_messages.user_id
                WHERE reply_messages.id = ${clanMessagesTable.replyToMessageId}
                LIMIT 1
            )`,
            replyToMessage: sql<string | null>`(
                SELECT reply_messages.message
                FROM clan_messages reply_messages
                WHERE reply_messages.id = ${clanMessagesTable.replyToMessageId}
                LIMIT 1
            )`,
        })
        .from(clanMessagesTable)
        .innerJoin(usersTable, eq(usersTable.id, clanMessagesTable.userId))
        .where(
            timeFilter
                ? and(eq(clanMessagesTable.clanId, clanId), timeFilter)
                : eq(clanMessagesTable.clanId, clanId),
        )
        .orderBy(
            afterDate
                ? asc(clanMessagesTable.createdAt)
                : desc(clanMessagesTable.createdAt),
            afterDate ? asc(clanMessagesTable.id) : desc(clanMessagesTable.id),
        )
        .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const messages = (afterDate ? pageRows : pageRows.reverse()).map((row) =>
        toClanMessage(row),
    );

    return c.json<GetClanMessagesResponse>({
        success: true,
        messages,
        hasMore,
    });
});

ClanRouter.post("/send_message", validateParams(zSendClanMessageRequest), async (c) => {
    const user = c.get("user")!;
    const { clanId, message, replyToId } = c.req.valid("json");

    const membership = await getUserMembership(user.id);
    if (!membership || membership.clanId !== clanId) {
        return c.json<SendClanMessageResponse>(
            { success: false, error: "not_in_clan" },
            403,
        );
    }

    const cleanMessage = message.trim().replace(/\s+/g, " ");
    if (!cleanMessage || checkForBadWords(cleanMessage)) {
        return c.json<SendClanMessageResponse>(
            { success: false, error: "invalid_message" },
            400,
        );
    }

    if (replyToId) {
        const replyMessage = await db.query.clanMessagesTable.findFirst({
            where: and(
                eq(clanMessagesTable.id, replyToId),
                eq(clanMessagesTable.clanId, clanId),
            ),
        });
        if (!replyMessage || replyMessage.type !== "user") {
            return c.json<SendClanMessageResponse>(
                { success: false, error: "reply_not_found" },
                400,
            );
        }
    }

    await pruneClanMessages(clanId);

    const [inserted] = await db
        .insert(clanMessagesTable)
        .values({
            clanId,
            userId: user.id,
            message: cleanMessage,
            replyToMessageId: replyToId,
        })
        .returning({
            id: clanMessagesTable.id,
            clanId: clanMessagesTable.clanId,
            type: clanMessagesTable.type,
            message: clanMessagesTable.message,
            createdAt: clanMessagesTable.createdAt,
        });

    await pruneClanMessages(clanId);
    const insertedMessage = await getClanMessageById(inserted.id);

    return c.json<SendClanMessageResponse>({
        success: true,
        message: insertedMessage!,
    });
});

ClanRouter.post("/resolve_klipy_gif", validateParams(zResolveKlipyGifRequest), async (c) => {
    const user = c.get("user")!;
    const { clanId, url } = c.req.valid("json");

    const membership = await getUserMembership(user.id);
    if (!membership || membership.clanId !== clanId) {
        return c.json<ResolveKlipyGifResponse>(
            { success: false, error: "not_in_clan" },
            403,
        );
    }

    if (!parseKlipyUrl(url)) {
        return c.json<ResolveKlipyGifResponse>(
            { success: false, error: "invalid_url" },
            400,
        );
    }

    try {
        const gif = await resolveKlipyGif(url);
        if (!gif) {
            return c.json<ResolveKlipyGifResponse>(
                { success: false, error: "not_found" },
                404,
            );
        }

        return c.json<ResolveKlipyGifResponse>({ success: true, gif });
    } catch {
        return c.json<ResolveKlipyGifResponse>(
            { success: false, error: "not_found" },
            404,
        );
    }
});

ClanRouter.post("/search_klipy_gifs", validateParams(zSearchKlipyGifsRequest), async (c) => {
    const user = c.get("user")!;
    const { clanId, query, section, limit, adMaxWidth, adMaxHeight } =
        c.req.valid("json");

    const membership = await getUserMembership(user.id);
    if (!membership || membership.clanId !== clanId) {
        return c.json<SearchKlipyGifsResponse>(
            { success: false, error: "not_in_clan" },
            403,
        );
    }

    if (!Config.secrets.KLIPY_API_KEY) {
        return c.json<SearchKlipyGifsResponse>(
            { success: false, error: "not_configured" },
            500,
        );
    }

    try {
        const gifs = await fetchKlipyGifPickerItems({
            query,
            section,
            limit,
            customerId: user.id,
            adMaxWidth,
            adMaxHeight,
            userAgent: c.req.header("user-agent"),
            ip: getHonoIp(c),
        });
        return c.json<SearchKlipyGifsResponse>({ success: true, gifs });
    } catch {
        return c.json<SearchKlipyGifsResponse>(
            { success: false, error: "not_found" },
            404,
        );
    }
});

ClanRouter.post("/edit_message", validateParams(zEditClanMessageRequest), async (c) => {
    const user = c.get("user")!;
    const { clanId, messageId, message } = c.req.valid("json");

    const membership = await getUserMembership(user.id);
    if (!membership || membership.clanId !== clanId) {
        return c.json<EditClanMessageResponse>(
            { success: false, error: "not_in_clan" },
            403,
        );
    }

    const existingMessage = await db.query.clanMessagesTable.findFirst({
        where: and(
            eq(clanMessagesTable.id, messageId),
            eq(clanMessagesTable.clanId, clanId),
        ),
    });
    if (!existingMessage) {
        return c.json<EditClanMessageResponse>(
            { success: false, error: "message_not_found" },
            404,
        );
    }
    if (existingMessage.type !== "user") {
        return c.json<EditClanMessageResponse>(
            { success: false, error: "not_author" },
            403,
        );
    }
    if (existingMessage.userId !== user.id) {
        return c.json<EditClanMessageResponse>(
            { success: false, error: "not_author" },
            403,
        );
    }

    const cleanMessage = message.trim().replace(/\s+/g, " ");
    if (!cleanMessage || checkForBadWords(cleanMessage)) {
        return c.json<EditClanMessageResponse>(
            { success: false, error: "invalid_message" },
            400,
        );
    }

    await db
        .update(clanMessagesTable)
        .set({ message: cleanMessage, editedAt: new Date() })
        .where(eq(clanMessagesTable.id, messageId));

    const updatedMessage = await getClanMessageById(messageId);
    return c.json<EditClanMessageResponse>({ success: true, message: updatedMessage! });
});

ClanRouter.post(
    "/delete_message",
    validateParams(zDeleteClanMessageRequest),
    async (c) => {
        const user = c.get("user")!;
        const { clanId, messageId } = c.req.valid("json");

        const membership = await getUserMembership(user.id);
        if (!membership || membership.clanId !== clanId) {
            return c.json<DeleteClanMessageResponse>(
                { success: false, error: "not_in_clan" },
                403,
            );
        }

        const existingMessage = await db.query.clanMessagesTable.findFirst({
            where: and(
                eq(clanMessagesTable.id, messageId),
                eq(clanMessagesTable.clanId, clanId),
            ),
        });
        if (!existingMessage) {
            return c.json<DeleteClanMessageResponse>(
                { success: false, error: "message_not_found" },
                404,
            );
        }
        if (existingMessage.type !== "user") {
            return c.json<DeleteClanMessageResponse>(
                { success: false, error: "not_author" },
                403,
            );
        }
        if (existingMessage.userId !== user.id) {
            return c.json<DeleteClanMessageResponse>(
                { success: false, error: "not_author" },
                403,
            );
        }

        await db.delete(clanMessagesTable).where(eq(clanMessagesTable.id, messageId));

        return c.json<DeleteClanMessageResponse>({ success: true, messageId });
    },
);

ClanRouter.post("/list", validateParams(zListClansRequest), async (c) => {
    const { page, limit, search } = c.req.valid("json");

    const offset = (page - 1) * limit;

    const totalCountResult = await db
        .select({ count: count() })
        .from(clansTable)
        .where(search ? sql`${clansTable.name} ILIKE ${`%${search}%`}` : undefined);

    const totalCount = totalCountResult[0]?.count || 0;

    const clansData = await db
        .select({
            id: clansTable.id,
            name: clansTable.name,
            icon: clansTable.icon,
            tagColor: clansTable.tagColor,
            ownerId: clansTable.ownerId,
            createdAt: clansTable.createdAt,
            memberCount: sql<number>`(
                SELECT COUNT(*) FROM clan_members 
                WHERE clan_members.clan_id = clans.id
            )`,
            totalKills: sql<number>`COALESCE((
                SELECT SUM(kills) FROM clan_member_stats 
                WHERE clan_member_stats.clan_id = clans.id
            ), 0)`,
            totalWins: sql<number>`COALESCE((
                SELECT SUM(wins) FROM clan_member_stats 
                WHERE clan_member_stats.clan_id = clans.id
            ), 0)`,
        })
        .from(clansTable)
        .where(search ? sql`${clansTable.name} ILIKE ${`%${search}%`}` : undefined)
        .orderBy(sql`(
            SELECT COUNT(*) FROM clan_members 
            WHERE clan_members.clan_id = clans.id
        ) DESC`)
        .limit(limit)
        .offset(offset);

    const clans: ClanInfo[] = clansData.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        tagColor: c.tagColor,
        ownerId: c.ownerId,
        memberCount: c.memberCount,
        maxMembers: ClanConstants.MaxMembers,
        createdAt: c.createdAt.getTime(),
        totalKills: c.totalKills,
        totalWins: c.totalWins,
    }));

    return c.json<ListClansResponse>({
        clans,
        totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit),
    });
});

ClanRouter.post("/leaderboard", validateParams(zClanLeaderboardRequest), async (c) => {
    const { type, gameMode, page, limit } = c.req.valid("json");

    const offset = (page - 1) * limit;

    const totalCountResult = await db.select({ count: count() }).from(clansTable);
    const totalCount = totalCountResult[0]?.count || 0;

    const clansData = await db
        .select({
            id: clansTable.id,
            name: clansTable.name,
            icon: clansTable.icon,
            tagColor: clansTable.tagColor,
            ownerId: clansTable.ownerId,
            createdAt: clansTable.createdAt,
            memberCount: sql<number>`(
                SELECT COUNT(*) FROM clan_members 
                WHERE clan_members.clan_id = clans.id
            )`,
            totalKills: sql<number>`COALESCE((
                SELECT SUM(kills) FROM clan_member_stats 
                WHERE clan_member_stats.clan_id = clans.id
                AND clan_member_stats.game_mode = ${gameMode}
            ), 0)`,
            totalWins: sql<number>`COALESCE((
                SELECT SUM(wins) FROM clan_member_stats 
                WHERE clan_member_stats.clan_id = clans.id
                AND clan_member_stats.game_mode = ${gameMode}
            ), 0)`,
        })
        .from(clansTable)
        .orderBy(
            desc(
                type === "kills"
                    ? sql<number>`COALESCE((
                        SELECT SUM(kills) FROM clan_member_stats
                        WHERE clan_member_stats.clan_id = clans.id
                        AND clan_member_stats.game_mode = ${gameMode}
                    ), 0)`
                    : sql<number>`COALESCE((
                        SELECT SUM(wins) FROM clan_member_stats
                        WHERE clan_member_stats.clan_id = clans.id
                        AND clan_member_stats.game_mode = ${gameMode}
                    ), 0)`,
            ),
        )
        .limit(limit)
        .offset(offset);

    const entries = clansData.map((c, index) => ({
        rank: offset + index + 1,
        clan: {
            id: c.id,
            name: c.name,
            icon: c.icon,
            tagColor: c.tagColor,
            ownerId: c.ownerId,
            memberCount: c.memberCount,
            maxMembers: ClanConstants.MaxMembers,
            createdAt: c.createdAt.getTime(),
            totalKills: c.totalKills,
            totalWins: c.totalWins,
        },
    }));

    return c.json<ClanLeaderboardResponse>({
        entries,
        totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit),
    });
});
