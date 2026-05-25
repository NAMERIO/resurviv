import { and, asc, count, desc, eq, gt, lt, sql } from "drizzle-orm";
import { Hono } from "hono";
import slugify from "slugify";
import {
    ClanConstants,
    type CancelClanJoinRequestResponse,
    type ClanDetail,
    type ClanInfo,
    type ClanJoinRequest,
    type ClanLeaderboardResponse,
    type ClanMember,
    type ClanMessage,
    type ClanWarHistoryEntry,
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
    type RequestJoinClanResponse,
    type RespondClanJoinRequestResponse,
    type ResolveKlipyGifResponse,
    type SearchKlipyGifsResponse,
    type SendClanMessageResponse,
    type TransferOwnershipResponse,
    type UpdateClanResponse,
    zCancelClanJoinRequest,
    zClanLeaderboardRequest,
    zCreateClanRequest,
    zDeleteClanMessageRequest,
    zEditClanMessageRequest,
    zGetClanMessagesRequest,
    zGetClanRequest,
    zJoinClanRequest,
    zKickMemberRequest,
    zListClansRequest,
    zRequestJoinClanRequest,
    zRespondClanJoinRequest,
    zResolveLobbyKlipyGifRequest,
    zResolveKlipyGifRequest,
    zSearchLobbyKlipyGifsRequest,
    zSearchKlipyGifsRequest,
    zSendClanMessageRequest,
    zTransferOwnershipRequest,
    zUpdateClanRequest,
} from "../../../../../shared/types/clan";
import { Config } from "../../../config";
import { checkForBadWords, validateUserName } from "../../../utils/serverHelpers";
import { server } from "../../apiServer";
import {
    authMiddleware,
    databaseEnabledMiddleware,
    rateLimitMiddleware,
    validateParams,
} from "../../auth/middleware";
import { db } from "../../db";
import {
    clanLeaveHistoryTable,
    clanJoinRequestsTable,
    clanMemberStatsTable,
    clanMembersTable,
    clanMessagesTable,
    clanSeasonMembersTable,
    clanWarHistoryTable,
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

const getRequestedSeason = (season?: number): number =>
    season ?? ClanConstants.CurrentSeason;

function calculateTotalCgp(cgpMilli: number, clanWarCgp: number) {
    const earnedCgp = (Number(cgpMilli) || 0) / ClanConstants.CgpScale;
    const warCgp = Number(clanWarCgp) || 0;

    return Number((earnedCgp + warCgp).toFixed(2));
}

function toStatNumber(value: unknown) {
    return Number(value) || 0;
}

function cgpScoreSql(season: number, gameMode?: string) {
    const gameModeFilter = gameMode
        ? sql`AND clan_member_stats.game_mode = ${gameMode}`
        : sql``;

    return sql<number>`(
        COALESCE((
            SELECT SUM(kill_cgp_milli + win_cgp_milli) FROM clan_member_stats
            WHERE clan_member_stats.clan_id = clans.id
            AND clan_member_stats.season = ${season}
            ${gameModeFilter}
        ), 0)
        + COALESCE((
            SELECT SUM(cgp_awarded) FROM clan_war_history
            WHERE clan_war_history.clan_id = clans.id
            AND clan_war_history.season = ${season}
        ), 0) * ${ClanConstants.CgpScale}
    )`;
}

async function getPlayoffClanIds(season: number) {
    const rows = await db
        .select({ id: clansTable.id })
        .from(clansTable)
        .orderBy(desc(cgpScoreSql(season)))
        .limit(ClanConstants.PlayoffClanCount);

    return new Set(rows.map((row) => row.id));
}

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

async function getClanMemberUserIds(clanId: string) {
    const rows = await db
        .select({ userId: clanMembersTable.userId })
        .from(clanMembersTable)
        .where(eq(clanMembersTable.clanId, clanId));

    return rows.map((row) => row.userId);
}

async function userHasPendingClanRequest(clanId: string, userId?: string | null) {
    if (!userId) return false;

    const request = await db.query.clanJoinRequestsTable.findFirst({
        where: and(
            eq(clanJoinRequestsTable.clanId, clanId),
            eq(clanJoinRequestsTable.userId, userId),
        ),
    });

    return !!request;
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
    slug?: string;
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
    file?: Record<string, unknown>;
    files?: Record<string, unknown>;
    media_formats?: {
        gif?: { url?: string; dims?: [number, number] };
        mediumgif?: { url?: string; dims?: [number, number] };
        tinygif?: { url?: string; dims?: [number, number] };
    };
};

type KlipyAdResult = Extract<KlipyGifPickerItem, { type: "ad" }>;
type KlipyGifPickerContentResult = Extract<KlipyGifPickerItem, { type: "gif" }>;

const KlipyPickerTimeoutMs = 2500;
const KlipyAdTimeoutMs = 900;

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

function toKlipyGifResult(
    result: KlipyApiGifObject,
    mode: "preview" | "full" = "full",
): KlipyGifResult | null {
    const gif =
        mode === "preview"
            ? (result.media_formats?.tinygif ??
              result.media_formats?.mediumgif ??
              result.media_formats?.gif)
            : (result.media_formats?.gif ??
              result.media_formats?.mediumgif ??
              result.media_formats?.tinygif);
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

function getNestedString(source: unknown, path: string[]) {
    let value = source;
    for (const key of path) {
        if (!value || typeof value !== "object") return null;
        value = (value as Record<string, unknown>)[key];
    }
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNestedNumber(source: unknown, path: string[]) {
    let value = source;
    for (const key of path) {
        if (!value || typeof value !== "object") return null;
        value = (value as Record<string, unknown>)[key];
    }
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
    return null;
}

function getKlipyNativeGifFile(result: KlipyApiGifObject) {
    return result.file || result.files || {};
}

function getKlipyNativeFileUrl(file: Record<string, unknown>, paths: string[][]) {
    for (const path of paths) {
        const url = getNestedString(file, path);
        if (url) return url;
    }
    return null;
}

function toKlipyNativeGifResult(
    result: KlipyApiGifObject,
    mode: "preview" | "full" = "full",
): KlipyGifResult | null {
    const file = getKlipyNativeGifFile(result);
    const previewPaths = [
        ["xs", "webp", "url"],
        ["xs", "gif", "url"],
        ["sm", "webp", "url"],
        ["sm", "gif", "url"],
        ["xs", "jpg", "url"],
        ["sm", "jpg", "url"],
        ["md", "webp", "url"],
        ["md", "gif", "url"],
    ];
    const fullPaths = [
        ["hd", "gif", "url"],
        ["gif", "url"],
        ["md", "gif", "url"],
        ["sm", "gif", "url"],
        ["xs", "gif", "url"],
        ["hd", "webp", "url"],
        ["gif", "webp", "url"],
        ["md", "webp", "url"],
        ["sm", "webp", "url"],
        ["xs", "webp", "url"],
    ];
    const gifUrl = getKlipyNativeFileUrl(
        file,
        mode === "preview" ? previewPaths : fullPaths,
    );
    if (!gifUrl) return null;

    const width =
        getNestedNumber(file, [mode === "preview" ? "xs" : "hd", "gif", "width"]) ||
        getNestedNumber(file, [mode === "preview" ? "xs" : "hd", "webp", "width"]) ||
        getNestedNumber(file, ["gif", "width"]);
    const height =
        getNestedNumber(file, [mode === "preview" ? "xs" : "hd", "gif", "height"]) ||
        getNestedNumber(file, [mode === "preview" ? "xs" : "hd", "webp", "height"]) ||
        getNestedNumber(file, ["gif", "height"]);

    return {
        id: result.id,
        url: gifUrl,
        sourceUrl:
            result.url ||
            result.itemurl ||
            (result.slug ? `https://klipy.com/gifs/${result.slug}` : gifUrl),
        title: result.title || "Klipy GIF",
        width,
        height,
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
        getStringValue(ad, [
            "image_url",
            "imageUrl",
            "image",
            "thumbnail",
            "thumbnail_url",
        ]),
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
        signal: AbortSignal.timeout(KlipyPickerTimeoutMs),
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
}): Promise<KlipyGifPickerItem[]> {
    const apiKey = Config.secrets.KLIPY_API_KEY;
    if (!apiKey) return [];

    const query = options.query || options.section || "";
    const nativeEndpoint = query ? "search" : "trending";
    const tenorEndpoint = query ? "search" : "featured";

    const fetchNativeResults = async (includeAds: boolean, timeoutMs: number) => {
        const params = new URLSearchParams({
            per_page: String(options.limit),
            page: "1",
        });
        if (query) {
            params.set("q", query);
        }
        if (includeAds) {
            params.set("customer_id", options.customerId);
            params.set("ad-min-width", "50");
            params.set("ad-max-width", String(options.adMaxWidth || 401));
            params.set("ad-min-height", "50");
            params.set("ad-max-height", String(options.adMaxHeight || 250));
        }

        const res = await fetch(
            `https://api.klipy.com/api/v1/${encodeURIComponent(apiKey)}/gifs/${nativeEndpoint}?${params}`,
            {
                signal: AbortSignal.timeout(timeoutMs),
            },
        );
        if (!res.ok) return null;

        const data = (await res.json()) as {
            data?: KlipyApiGifObject[] | { data?: KlipyApiGifObject[] };
        };
        if (Array.isArray(data.data)) return data.data;
        return data.data?.data || [];
    };

    const fetchTenorCompatibleResults = async () => {
        const params = new URLSearchParams({
            key: apiKey,
            limit: String(options.limit),
            media_filter: "gif,tinygif,mediumgif",
        });
        if (query) {
            params.set("q", query);
        }

        const res = await fetch(`https://api.klipy.com/v2/${tenorEndpoint}?${params}`, {
            signal: AbortSignal.timeout(KlipyPickerTimeoutMs),
        });
        if (!res.ok) return null;

        const data = (await res.json()) as { results?: KlipyApiGifObject[] };
        return data.results || [];
    };

    const toPickerItem = (result: KlipyApiGifObject): KlipyGifPickerItem | null => {
        const ad = toKlipyAdResult(result);
        if (ad) return ad;

        const gif =
            toKlipyNativeGifResult(result, "preview") ||
            toKlipyGifResult(result, "preview");
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
    };

    const fetchContentItems = async () => {
        let results = await fetchNativeResults(false, KlipyPickerTimeoutMs);
        if (!results || results.length === 0) {
            results = await fetchTenorCompatibleResults();
        }

        return (results || [])
            .map(toPickerItem)
            .filter((item): item is KlipyGifPickerContentResult => item?.type === "gif");
    };

    const fetchAdItem = async () => {
        try {
            const results = await fetchNativeResults(true, KlipyAdTimeoutMs);
            return (
                (results || [])
                    .map(toPickerItem)
                    .find((item): item is KlipyAdResult => item?.type === "ad") || null
            );
        } catch {
            return null;
        }
    };

    const [contentItems, adItem] = await Promise.all([
        fetchContentItems(),
        fetchAdItem(),
    ]);
    const pickerItems: KlipyGifPickerItem[] = [...contentItems];
    if (adItem && pickerItems.length >= 3) {
        pickerItems.splice(3, 0, adItem);
    } else if (adItem) {
        pickerItems.push(adItem);
    }
    return pickerItems;
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

async function trackClanSeasonMember(clanId: string, userId: string) {
    await db
        .insert(clanSeasonMembersTable)
        .values({
            clanId,
            userId,
            season: ClanConstants.CurrentSeason,
        })
        .onConflictDoUpdate({
            target: [
                clanSeasonMembersTable.clanId,
                clanSeasonMembersTable.userId,
                clanSeasonMembersTable.season,
            ],
            set: {
                leftAt: null,
            },
        });
}

async function addClanMember(clanId: string, userId: string, username: string) {
    await db.insert(clanMembersTable).values({
        clanId,
        userId,
    });

    await trackClanSeasonMember(clanId, userId);

    await db
        .insert(clanMemberStatsTable)
        .values({
            clanId,
            userId,
            season: ClanConstants.CurrentSeason,
            kills: 0,
            wins: 0,
            killCgpMilli: 0,
            winCgpMilli: 0,
        })
        .onConflictDoNothing();

    await db
        .delete(clanJoinRequestsTable)
        .where(eq(clanJoinRequestsTable.userId, userId));

    await createClanSystemMessage(
        clanId,
        userId,
        "member_join",
        `${username} joined the clan.`,
    );
}

async function closeClanSeasonMember(clanId: string, userId: string) {
    await db
        .update(clanSeasonMembersTable)
        .set({ leftAt: new Date() })
        .where(
            and(
                eq(clanSeasonMembersTable.clanId, clanId),
                eq(clanSeasonMembersTable.userId, userId),
                eq(clanSeasonMembersTable.season, ClanConstants.CurrentSeason),
            ),
        );
}

async function getClanInfo(
    clanId: string,
    season: number = ClanConstants.CurrentSeason,
    viewerUserId?: string | null,
): Promise<ClanInfo | null> {
    const clan = await db.query.clansTable.findFirst({
        where: eq(clansTable.id, clanId),
    });

    if (!clan) return null;

    const isCurrentSeason = season === ClanConstants.CurrentSeason;
    const memberCountResult = isCurrentSeason
        ? await db
              .select({ count: count() })
              .from(clanMembersTable)
              .where(eq(clanMembersTable.clanId, clanId))
        : await db
              .select({ count: count() })
              .from(clanSeasonMembersTable)
              .where(
                  and(
                      eq(clanSeasonMembersTable.clanId, clanId),
                      eq(clanSeasonMembersTable.season, season),
                  ),
              );

    const statsResult = await db
        .select({
            totalKills: sql<number>`COALESCE(SUM(${clanMemberStatsTable.kills}), 0)`,
            totalWins: sql<number>`COALESCE(SUM(${clanMemberStatsTable.wins}), 0)`,
            totalCgpMilli: sql<number>`COALESCE(SUM(${clanMemberStatsTable.killCgpMilli} + ${clanMemberStatsTable.winCgpMilli}), 0)`,
        })
        .from(clanMemberStatsTable)
        .where(
            and(
                eq(clanMemberStatsTable.clanId, clanId),
                eq(clanMemberStatsTable.season, season),
            ),
        );
    const clanWarStatsResult = await db
        .select({
            clanWarCgp: sql<number>`COALESCE(SUM(${clanWarHistoryTable.cgpAwarded}), 0)`,
            clanWarsPlayed: count(),
        })
        .from(clanWarHistoryTable)
        .where(
            and(
                eq(clanWarHistoryTable.clanId, clanId),
                eq(clanWarHistoryTable.season, season),
            ),
        );
    const playoffClanIds = await getPlayoffClanIds(season);
    const totalKills = toStatNumber(statsResult[0]?.totalKills);
    const totalWins = toStatNumber(statsResult[0]?.totalWins);
    const totalCgpMilli = toStatNumber(statsResult[0]?.totalCgpMilli);
    const clanWarCgp = toStatNumber(clanWarStatsResult[0]?.clanWarCgp);

    return {
        id: clan.id,
        name: clan.name,
        icon: clan.icon,
        tagColor: clan.tagColor,
        ownerId: clan.ownerId,
        memberCount: memberCountResult[0]?.count || 0,
        maxMembers: ClanConstants.MaxMembers,
        createdAt: clan.createdAt.getTime(),
        totalCgp: calculateTotalCgp(totalCgpMilli, clanWarCgp),
        totalKills,
        totalWins,
        clanWarCgp,
        clanWarsPlayed: toStatNumber(clanWarStatsResult[0]?.clanWarsPlayed),
        season,
        isCurrentSeason,
        playoffQualified: playoffClanIds.has(clan.id),
        isLocked: clan.isLocked,
        requestPending: await userHasPendingClanRequest(clan.id, viewerUserId),
    };
}

async function getClanDetail(
    clanId: string,
    season: number = ClanConstants.CurrentSeason,
    viewerUserId?: string | null,
): Promise<ClanDetail | null> {
    const clanInfo = await getClanInfo(clanId, season, viewerUserId);
    if (!clanInfo) return null;

    const membersData = clanInfo.isCurrentSeason
        ? await db
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
                AND clan_member_stats.season = ${season}
            ), 0)`,
                  wins: sql<number>`COALESCE((
                SELECT SUM(wins) FROM clan_member_stats
                WHERE clan_member_stats.clan_id = ${clanMembersTable.clanId}
                AND clan_member_stats.user_id = ${clanMembersTable.userId}
                AND clan_member_stats.season = ${season}
            ), 0)`,
              })
              .from(clanMembersTable)
              .innerJoin(usersTable, eq(usersTable.id, clanMembersTable.userId))
              .where(eq(clanMembersTable.clanId, clanId))
        : await db
              .select({
                  odUserId: usersTable.id,
                  username: usersTable.username,
                  slug: usersTable.slug,
                  playerIcon: sql<string>`${usersTable.loadout}->>'player_icon'`,
                  joinedAt: clanSeasonMembersTable.joinedAt,
                  kills: sql<number>`COALESCE((
                SELECT SUM(kills) FROM clan_member_stats
                WHERE clan_member_stats.clan_id = ${clanSeasonMembersTable.clanId}
                AND clan_member_stats.user_id = ${clanSeasonMembersTable.userId}
                AND clan_member_stats.season = ${season}
            ), 0)`,
                  wins: sql<number>`COALESCE((
                SELECT SUM(wins) FROM clan_member_stats
                WHERE clan_member_stats.clan_id = ${clanSeasonMembersTable.clanId}
                AND clan_member_stats.user_id = ${clanSeasonMembersTable.userId}
                AND clan_member_stats.season = ${season}
            ), 0)`,
              })
              .from(clanSeasonMembersTable)
              .innerJoin(usersTable, eq(usersTable.id, clanSeasonMembersTable.userId))
              .where(
                  and(
                      eq(clanSeasonMembersTable.clanId, clanId),
                      eq(clanSeasonMembersTable.season, season),
                  ),
              );

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

    if (clanInfo.isCurrentSeason) {
        for (const member of members) {
            await trackClanSeasonMember(clanId, member.odUserId);
        }
    }

    const clanWarRows = await db
        .select({
            id: clanWarHistoryTable.id,
            opponentClanName: clanWarHistoryTable.opponentClanName,
            result: clanWarHistoryTable.result,
            cgpAwarded: clanWarHistoryTable.cgpAwarded,
            createdAt: clanWarHistoryTable.createdAt,
        })
        .from(clanWarHistoryTable)
        .where(
            and(
                eq(clanWarHistoryTable.clanId, clanId),
                eq(clanWarHistoryTable.season, season),
            ),
        )
        .orderBy(desc(clanWarHistoryTable.createdAt))
        .limit(20);

    const clanWarHistory: ClanWarHistoryEntry[] = clanWarRows.map((war) => ({
        id: war.id,
        opponentClanName: war.opponentClanName,
        result: war.result,
        cgpAwarded: war.cgpAwarded,
        createdAt: war.createdAt.getTime(),
    }));

    const canViewRequests = !!viewerUserId && viewerUserId === clanInfo.ownerId;
    const joinRequests: ClanJoinRequest[] = canViewRequests
        ? (
              await db
                  .select({
                      id: clanJoinRequestsTable.id,
                      odUserId: usersTable.id,
                      username: usersTable.username,
                      slug: usersTable.slug,
                      playerIcon: sql<string>`${usersTable.loadout}->>'player_icon'`,
                      requestedAt: clanJoinRequestsTable.createdAt,
                  })
                  .from(clanJoinRequestsTable)
                  .innerJoin(usersTable, eq(usersTable.id, clanJoinRequestsTable.userId))
                  .where(eq(clanJoinRequestsTable.clanId, clanId))
                  .orderBy(asc(clanJoinRequestsTable.createdAt))
          ).map((request) => ({
              id: request.id,
              odUserId: request.odUserId,
              username: request.username,
              slug: request.slug,
              playerIcon: request.playerIcon || "emote_surviv",
              requestedAt: request.requestedAt.getTime(),
          }))
        : [];

    return {
        ...clanInfo,
        members,
        clanWarHistory,
        joinRequests,
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

    const clan = await getClanDetail(
        membership.clanId,
        ClanConstants.CurrentSeason,
        user.id,
    );

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

    await trackClanSeasonMember(newClan.id, user.id);

    await db
        .delete(clanJoinRequestsTable)
        .where(eq(clanJoinRequestsTable.userId, user.id));

    await db.insert(clanMemberStatsTable).values({
        clanId: newClan.id,
        userId: user.id,
        season: ClanConstants.CurrentSeason,
        kills: 0,
        wins: 0,
        killCgpMilli: 0,
        winCgpMilli: 0,
    });

    const clanInfo = await getClanInfo(newClan.id, ClanConstants.CurrentSeason, user.id);

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

    if (clan.isLocked) {
        return c.json<JoinClanResponse>({ success: false, error: "clan_locked" }, 400);
    }

    await addClanMember(clanId, user.id, user.username);

    const clanInfo = await getClanInfo(clanId, ClanConstants.CurrentSeason, user.id);

    return c.json<JoinClanResponse>({ success: true, clan: clanInfo! });
});

ClanRouter.post(
    "/request_join",
    validateParams(zRequestJoinClanRequest),
    async (c) => {
        const user = c.get("user")!;
        const { clanId } = c.req.valid("json");

        const existingMembership = await db.query.clanMembersTable.findFirst({
            where: eq(clanMembersTable.userId, user.id),
        });

        if (existingMembership) {
            return c.json<RequestJoinClanResponse>(
                { success: false, error: "already_in_clan" },
                400,
            );
        }

        const lastLeave = await db.query.clanLeaveHistoryTable.findFirst({
            where: eq(clanLeaveHistoryTable.userId, user.id),
            orderBy: desc(clanLeaveHistoryTable.leftAt),
        });

        if (lastLeave) {
            const cooldownEnd =
                lastLeave.leftAt.getTime() + ClanConstants.RejoinCooldownMs;
            if (Date.now() < cooldownEnd) {
                return c.json<RequestJoinClanResponse>(
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
            return c.json<RequestJoinClanResponse>(
                { success: false, error: "clan_not_found" },
                404,
            );
        }

        const memberCount = await db
            .select({ count: count() })
            .from(clanMembersTable)
            .where(eq(clanMembersTable.clanId, clanId));

        if ((memberCount[0]?.count || 0) >= ClanConstants.MaxMembers) {
            return c.json<RequestJoinClanResponse>(
                { success: false, error: "clan_full" },
                400,
            );
        }

        const existingRequest = await db.query.clanJoinRequestsTable.findFirst({
            where: and(
                eq(clanJoinRequestsTable.clanId, clanId),
                eq(clanJoinRequestsTable.userId, user.id),
            ),
        });

        if (existingRequest) {
            return c.json<RequestJoinClanResponse>(
                { success: false, error: "already_requested" },
                400,
            );
        }

        await db.insert(clanJoinRequestsTable).values({
            clanId,
            userId: user.id,
        });

        await createClanSystemMessage(
            clanId,
            user.id,
            "member_join",
            `${user.username} requested to join the clan.`,
        );

        server.notifyUsersSocialEvent([clan.ownerId], {
            type: "clan_join_requests_changed",
            clanId,
        });

        return c.json<RequestJoinClanResponse>({
            success: true,
            requestPending: true,
        });
    },
);

ClanRouter.post(
    "/cancel_request",
    validateParams(zCancelClanJoinRequest),
    async (c) => {
        const user = c.get("user")!;
        const { clanId } = c.req.valid("json");

        const deleted = await db
            .delete(clanJoinRequestsTable)
            .where(
                and(
                    eq(clanJoinRequestsTable.clanId, clanId),
                    eq(clanJoinRequestsTable.userId, user.id),
                ),
            )
            .returning({
                clanId: clanJoinRequestsTable.clanId,
            });

        if (deleted.length === 0) {
            return c.json<CancelClanJoinRequestResponse>(
                { success: false, error: "request_not_found" },
                404,
            );
        }

        const clan = await db.query.clansTable.findFirst({
            where: eq(clansTable.id, clanId),
        });
        if (clan) {
            server.notifyUsersSocialEvent([clan.ownerId], {
                type: "clan_join_requests_changed",
                clanId,
            });
        }

        return c.json<CancelClanJoinRequestResponse>({ success: true });
    },
);

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

    await closeClanSeasonMember(membership.clanId, user.id);

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

    await closeClanSeasonMember(clan.id, memberId);

    await db.insert(clanLeaveHistoryTable).values({
        userId: memberId,
    });

    await createClanSystemMessage(
        clan.id,
        memberId,
        "member_leave",
        `${user.username} kicked ${kickedUser?.username || "a member"} from the clan.`,
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

ClanRouter.post(
    "/respond_request",
    validateParams(zRespondClanJoinRequest),
    async (c) => {
        const user = c.get("user")!;
        const { requestId, action } = c.req.valid("json");

        const membership = await db.query.clanMembersTable.findFirst({
            where: eq(clanMembersTable.userId, user.id),
        });

        if (!membership) {
            return c.json<RespondClanJoinRequestResponse>(
                { success: false, error: "not_owner" },
                403,
            );
        }

        const clan = await db.query.clansTable.findFirst({
            where: eq(clansTable.id, membership.clanId),
        });

        if (!clan || clan.ownerId !== user.id) {
            return c.json<RespondClanJoinRequestResponse>(
                { success: false, error: "not_owner" },
                403,
            );
        }

        const request = await db.query.clanJoinRequestsTable.findFirst({
            where: and(
                eq(clanJoinRequestsTable.id, requestId),
                eq(clanJoinRequestsTable.clanId, clan.id),
            ),
        });

        if (!request) {
            return c.json<RespondClanJoinRequestResponse>(
                { success: false, error: "request_not_found" },
                404,
            );
        }

        if (action === "decline") {
            await db
                .delete(clanJoinRequestsTable)
                .where(eq(clanJoinRequestsTable.id, request.id));
            return c.json<RespondClanJoinRequestResponse>({ success: true });
        }

        const existingMembership = await db.query.clanMembersTable.findFirst({
            where: eq(clanMembersTable.userId, request.userId),
        });

        if (existingMembership) {
            await db
                .delete(clanJoinRequestsTable)
                .where(eq(clanJoinRequestsTable.id, request.id));
            return c.json<RespondClanJoinRequestResponse>(
                { success: false, error: "already_in_clan" },
                400,
            );
        }

        const memberCount = await db
            .select({ count: count() })
            .from(clanMembersTable)
            .where(eq(clanMembersTable.clanId, clan.id));

        if ((memberCount[0]?.count || 0) >= ClanConstants.MaxMembers) {
            return c.json<RespondClanJoinRequestResponse>(
                { success: false, error: "clan_full" },
                400,
            );
        }

        const requester = await db.query.usersTable.findFirst({
            where: eq(usersTable.id, request.userId),
        });

        await addClanMember(
            clan.id,
            request.userId,
            requester?.username || "A member",
        );

        return c.json<RespondClanJoinRequestResponse>({ success: true });
    },
);

ClanRouter.post("/update", validateParams(zUpdateClanRequest), async (c) => {
    const user = c.get("user")!;
    const { name, icon, tagColor, isLocked } = c.req.valid("json");

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
        isLocked: boolean;
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

    if (isLocked !== undefined && isLocked !== clan.isLocked) {
        updates.isLocked = isLocked;
    }

    if (Object.keys(updates).length > 0) {
        await db.update(clansTable).set(updates).where(eq(clansTable.id, clan.id));
    }

    const updatedClan = await getClanDetail(
        clan.id,
        ClanConstants.CurrentSeason,
        user.id,
    );

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
    const user = c.get("user")!;
    const { clanId, season } = c.req.valid("json");

    const clan = await getClanDetail(clanId, getRequestedSeason(season), user.id);

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
    const memberUserIds = await getClanMemberUserIds(clanId);
    server.notifyUsersSocialEvent(memberUserIds, {
        type: "clan_messages_changed",
        clanId,
    });
    server.notifyUsersSocialEvent(
        memberUserIds.filter((memberUserId) => memberUserId !== user.id),
        {
            type: "clan_mentions_changed",
            clanId,
        },
    );

    return c.json<SendClanMessageResponse>({
        success: true,
        message: insertedMessage!,
    });
});

ClanRouter.post(
    "/resolve_klipy_gif",
    validateParams(zResolveKlipyGifRequest),
    async (c) => {
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
    },
);

ClanRouter.post(
    "/search_klipy_gifs",
    validateParams(zSearchKlipyGifsRequest),
    async (c) => {
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
            });
            return c.json<SearchKlipyGifsResponse>({ success: true, gifs });
        } catch {
            return c.json<SearchKlipyGifsResponse>(
                { success: false, error: "not_found" },
                404,
            );
        }
    },
);

ClanRouter.post(
    "/resolve_lobby_klipy_gif",
    validateParams(zResolveLobbyKlipyGifRequest),
    async (c) => {
        const { url } = c.req.valid("json");

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
    },
);

ClanRouter.post(
    "/search_lobby_klipy_gifs",
    validateParams(zSearchLobbyKlipyGifsRequest),
    async (c) => {
        const user = c.get("user")!;
        const { query, section, limit, adMaxWidth, adMaxHeight } = c.req.valid("json");

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
            });
            return c.json<SearchKlipyGifsResponse>({ success: true, gifs });
        } catch {
            return c.json<SearchKlipyGifsResponse>(
                { success: false, error: "not_found" },
                404,
            );
        }
    },
);

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
    const memberUserIds = await getClanMemberUserIds(clanId);
    server.notifyUsersSocialEvent(memberUserIds, {
        type: "clan_messages_changed",
        clanId,
    });
    server.notifyUsersSocialEvent(
        memberUserIds.filter((memberUserId) => memberUserId !== user.id),
        {
            type: "clan_mentions_changed",
            clanId,
        },
    );

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
        server.notifyUsersSocialEvent(await getClanMemberUserIds(clanId), {
            type: "clan_messages_changed",
            clanId,
        });

        return c.json<DeleteClanMessageResponse>({ success: true, messageId });
    },
);

ClanRouter.post("/list", validateParams(zListClansRequest), async (c) => {
    const user = c.get("user")!;
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
            isLocked: clansTable.isLocked,
            ownerId: clansTable.ownerId,
            createdAt: clansTable.createdAt,
            memberCount: sql<number>`(
                SELECT COUNT(*) FROM clan_members 
                WHERE clan_members.clan_id = clans.id
            )`,
            totalKills: sql<number>`COALESCE((
                SELECT SUM(kills) FROM clan_member_stats 
                WHERE clan_member_stats.clan_id = clans.id
                AND clan_member_stats.season = ${ClanConstants.CurrentSeason}
            ), 0)`,
            totalWins: sql<number>`COALESCE((
                SELECT SUM(wins) FROM clan_member_stats 
                WHERE clan_member_stats.clan_id = clans.id
                AND clan_member_stats.season = ${ClanConstants.CurrentSeason}
            ), 0)`,
            totalCgpMilli: sql<number>`COALESCE((
                SELECT SUM(kill_cgp_milli + win_cgp_milli) FROM clan_member_stats
                WHERE clan_member_stats.clan_id = clans.id
                AND clan_member_stats.season = ${ClanConstants.CurrentSeason}
            ), 0)`,
            clanWarCgp: sql<number>`COALESCE((
                SELECT SUM(cgp_awarded) FROM clan_war_history
                WHERE clan_war_history.clan_id = clans.id
                AND clan_war_history.season = ${ClanConstants.CurrentSeason}
            ), 0)`,
            clanWarsPlayed: sql<number>`(
                SELECT COUNT(*) FROM clan_war_history
                WHERE clan_war_history.clan_id = clans.id
                AND clan_war_history.season = ${ClanConstants.CurrentSeason}
            )`,
        })
        .from(clansTable)
        .where(search ? sql`${clansTable.name} ILIKE ${`%${search}%`}` : undefined)
        .orderBy(sql`(
            SELECT COUNT(*) FROM clan_members 
            WHERE clan_members.clan_id = clans.id
        ) DESC`)
        .limit(limit)
        .offset(offset);
    const playoffClanIds = await getPlayoffClanIds(ClanConstants.CurrentSeason);
    const pendingRequestRows = await db
        .select({ clanId: clanJoinRequestsTable.clanId })
        .from(clanJoinRequestsTable)
        .where(eq(clanJoinRequestsTable.userId, user.id));
    const pendingRequestClanIds = new Set(
        pendingRequestRows.map((row) => row.clanId),
    );

    const clans: ClanInfo[] = clansData.map((c) => {
        const totalKills = toStatNumber(c.totalKills);
        const totalWins = toStatNumber(c.totalWins);
        const totalCgpMilli = toStatNumber(c.totalCgpMilli);
        const clanWarCgp = toStatNumber(c.clanWarCgp);

        return {
            id: c.id,
            name: c.name,
            icon: c.icon,
            tagColor: c.tagColor,
            ownerId: c.ownerId,
            memberCount: toStatNumber(c.memberCount),
            maxMembers: ClanConstants.MaxMembers,
            createdAt: c.createdAt.getTime(),
            totalCgp: calculateTotalCgp(totalCgpMilli, clanWarCgp),
            totalKills,
            totalWins,
            clanWarCgp,
            clanWarsPlayed: toStatNumber(c.clanWarsPlayed),
            season: ClanConstants.CurrentSeason,
            isCurrentSeason: true,
            playoffQualified: playoffClanIds.has(c.id),
            isLocked: c.isLocked,
            requestPending: pendingRequestClanIds.has(c.id),
        };
    });

    return c.json<ListClansResponse>({
        clans,
        totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit),
    });
});

ClanRouter.post("/leaderboard", validateParams(zClanLeaderboardRequest), async (c) => {
    const { type, gameMode, page, limit, season } = c.req.valid("json");

    const offset = (page - 1) * limit;
    const statGameMode = type === "cgp" ? undefined : gameMode;
    const gameModeFilter = statGameMode
        ? sql`AND clan_member_stats.game_mode = ${statGameMode}`
        : sql``;
    const memberCountSql =
        season === ClanConstants.CurrentSeason
            ? sql<number>`(
                SELECT COUNT(*) FROM clan_members
                WHERE clan_members.clan_id = clans.id
            )`
            : sql<number>`(
                SELECT COUNT(*) FROM clan_season_members
                WHERE clan_season_members.clan_id = clans.id
                AND clan_season_members.season = ${season}
            )`;

    const totalCountResult = await db.select({ count: count() }).from(clansTable);
    const totalCount = totalCountResult[0]?.count || 0;
    const orderSql =
        type === "cgp"
            ? cgpScoreSql(season)
            : type === "kills"
              ? sql<number>`COALESCE((
                    SELECT SUM(kills) FROM clan_member_stats
                    WHERE clan_member_stats.clan_id = clans.id
                    AND clan_member_stats.game_mode = ${gameMode}
                    AND clan_member_stats.season = ${season}
                ), 0)`
              : sql<number>`COALESCE((
                    SELECT SUM(wins) FROM clan_member_stats
                    WHERE clan_member_stats.clan_id = clans.id
                    AND clan_member_stats.game_mode = ${gameMode}
                    AND clan_member_stats.season = ${season}
                ), 0)`;

    const clansData = await db
        .select({
            id: clansTable.id,
            name: clansTable.name,
            icon: clansTable.icon,
            tagColor: clansTable.tagColor,
            isLocked: clansTable.isLocked,
            ownerId: clansTable.ownerId,
            createdAt: clansTable.createdAt,
            memberCount: memberCountSql,
            totalKills: sql<number>`COALESCE((
                SELECT SUM(kills) FROM clan_member_stats 
                WHERE clan_member_stats.clan_id = clans.id
                AND clan_member_stats.season = ${season}
                ${gameModeFilter}
            ), 0)`,
            totalWins: sql<number>`COALESCE((
                SELECT SUM(wins) FROM clan_member_stats 
                WHERE clan_member_stats.clan_id = clans.id
                AND clan_member_stats.season = ${season}
                ${gameModeFilter}
            ), 0)`,
            totalCgpMilli: sql<number>`COALESCE((
                SELECT SUM(kill_cgp_milli + win_cgp_milli) FROM clan_member_stats
                WHERE clan_member_stats.clan_id = clans.id
                AND clan_member_stats.season = ${season}
                ${gameModeFilter}
            ), 0)`,
            clanWarCgp: sql<number>`COALESCE((
                SELECT SUM(cgp_awarded) FROM clan_war_history
                WHERE clan_war_history.clan_id = clans.id
                AND clan_war_history.season = ${season}
            ), 0)`,
            clanWarsPlayed: sql<number>`(
                SELECT COUNT(*) FROM clan_war_history
                WHERE clan_war_history.clan_id = clans.id
                AND clan_war_history.season = ${season}
            )`,
        })
        .from(clansTable)
        .orderBy(desc(orderSql))
        .limit(limit)
        .offset(offset);
    const playoffClanIds = await getPlayoffClanIds(season);

    const entries = clansData.map((c, index) => {
        const totalKills = toStatNumber(c.totalKills);
        const totalWins = toStatNumber(c.totalWins);
        const totalCgpMilli = toStatNumber(c.totalCgpMilli);
        const clanWarCgp = toStatNumber(c.clanWarCgp);

        return {
            rank: offset + index + 1,
            clan: {
                id: c.id,
                name: c.name,
                icon: c.icon,
                tagColor: c.tagColor,
                ownerId: c.ownerId,
                memberCount: toStatNumber(c.memberCount),
                maxMembers: ClanConstants.MaxMembers,
                createdAt: c.createdAt.getTime(),
                totalCgp: calculateTotalCgp(totalCgpMilli, clanWarCgp),
                totalKills,
                totalWins,
                clanWarCgp,
                clanWarsPlayed: toStatNumber(c.clanWarsPlayed),
                season,
                isCurrentSeason: season === ClanConstants.CurrentSeason,
                playoffQualified: playoffClanIds.has(c.id),
                isLocked: c.isLocked,
                requestPending: false,
            },
        };
    });

    return c.json<ClanLeaderboardResponse>({
        entries,
        totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit),
    });
});
