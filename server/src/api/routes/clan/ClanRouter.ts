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
    type LeaveClanResponse,
    type ListClansResponse,
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
    zSendClanMessageRequest,
    zTransferOwnershipRequest,
    zUpdateClanRequest,
} from "../../../../../shared/types/clan";
import { checkForBadWords, validateUserName } from "../../../utils/serverHelpers";
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

function getUserMembership(userId: string) {
    return db.query.clanMembersTable.findFirst({
        where: eq(clanMembersTable.userId, userId),
    });
}

function toClanMessage(row: {
    id: string;
    clanId: string;
    senderId: string;
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
    return {
        id: row.id,
        clanId: row.clanId,
        senderId: row.senderId,
        username: row.username,
        slug: row.slug,
        playerIcon: row.playerIcon || "emote_surviv",
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
        if (!replyMessage) {
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
