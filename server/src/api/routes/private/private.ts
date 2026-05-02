import { and, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { saveConfig } from "../../../../../config";
import { GameObjectDefs } from "../../../../../shared/defs/gameObjectDefs";
import { PassDefs } from "../../../../../shared/defs/gameObjects/passDefs";
import { QuestDefs } from "../../../../../shared/defs/gameObjects/questDefs";
import { MapDefs } from "../../../../../shared/defs/mapDefs";
import { TeamMode } from "../../../../../shared/gameConfig";
import {
    zGetGpParams,
    zGiveGpParams,
    zGiveItemParams,
    zRemoveGpParams,
    zRemoveItemParams,
} from "../../../../../shared/types/moderation";
import {
    GameModeStatus,
    type GameModeStatus as GameModeStatusType,
} from "../../../../../shared/types/stats";
import { passUtil } from "../../../../../shared/utils/passUtil";
import { serverConfigPath } from "../../../config";
import { isBehindProxy } from "../../../utils/serverHelpers";
import {
    type SaveGameBody,
    zSetClientThemeBody,
    zSetGameModeBody,
    zUpdateRegionBody,
} from "../../../utils/types";
import type { Context } from "../..";
import { server } from "../../apiServer";
import {
    databaseEnabledMiddleware,
    privateMiddleware,
    validateParams,
} from "../../auth/middleware";
import { getRedisClient } from "../../cache";
import { leaderboardCache } from "../../cache/leaderboard";
import { db } from "../../db";
import {
    clanMemberStatsTable,
    clanMembersTable,
    itemsTable,
    type MatchDataTable,
    matchDataTable,
    userPassTable,
    userQuestTable,
    usersTable,
} from "../../db/schema";
import { MOCK_USER_ID } from "../user/auth/mock";
import { passType, premiumPassUnlockType } from "../user/PassRouter";
import { isBanned, logPlayerIPs, ModerationRouter } from "./ModerationRouter";

// Helper function to update clan stats for players who are in clans
async function updateClanStats(matchData: MatchDataTable[]) {
    try {
        const aggregatedMatchData = new Map<
            string,
            {
                userId: string;
                createdAt: Date | string | undefined;
                gameMode: GameModeStatusType;
                kills: number;
                rank: number;
            }
        >();

        for (const data of matchData) {
            if (!data.userId) continue;

            const gameMode = data.gameMode ?? GameModeStatus.Deathmatch;
            const key = `${data.gameId}:${data.userId}:${gameMode}`;
            const existing = aggregatedMatchData.get(key);

            if (existing) {
                existing.kills += data.kills || 0;
                existing.rank = Math.min(existing.rank, data.rank || Infinity);
                if (
                    data.createdAt &&
                    (!existing.createdAt ||
                        new Date(data.createdAt).getTime() >
                            new Date(existing.createdAt).getTime())
                ) {
                    existing.createdAt = data.createdAt;
                }
                continue;
            }

            aggregatedMatchData.set(key, {
                userId: data.userId,
                createdAt: data.createdAt,
                gameMode,
                kills: data.kills || 0,
                rank: data.rank || Infinity,
            });
        }

        for (const data of aggregatedMatchData.values()) {
            if (!data.userId) continue;

            // Check if the player is in a clan
            const membership = await db.query.clanMembersTable.findFirst({
                where: eq(clanMembersTable.userId, data.userId),
            });

            if (!membership) continue;

            // Check if this match was played after the player joined the clan
            const matchTime =
                data.createdAt instanceof Date
                    ? data.createdAt
                    : new Date(data.createdAt!);
            if (matchTime < membership.joinedAt) continue;

            // Update the clan member's stats
            const kills = data.kills || 0;
            const wins = data.rank === 1 ? 1 : 0;

            // Check if stats record exists
            const existingStats = await db.query.clanMemberStatsTable.findFirst({
                where: and(
                    eq(clanMemberStatsTable.clanId, membership.clanId),
                    eq(clanMemberStatsTable.userId, data.userId),
                    eq(clanMemberStatsTable.gameMode, data.gameMode),
                ),
            });

            if (existingStats) {
                await db
                    .update(clanMemberStatsTable)
                    .set({
                        kills: sql`${clanMemberStatsTable.kills} + ${kills}`,
                        wins: sql`${clanMemberStatsTable.wins} + ${wins}`,
                    })
                    .where(
                        and(
                            eq(clanMemberStatsTable.clanId, membership.clanId),
                            eq(clanMemberStatsTable.userId, data.userId),
                            eq(clanMemberStatsTable.gameMode, data.gameMode),
                        ),
                    );
            } else {
                // Create new stats record
                await db.insert(clanMemberStatsTable).values({
                    clanId: membership.clanId,
                    userId: data.userId,
                    gameMode: data.gameMode,
                    kills,
                    wins,
                });
            }
        }
    } catch (err) {
        server.logger.error("Error updating clan stats:", err);
    }
}

export const PrivateRouter = new Hono<Context>()
    .use(privateMiddleware)
    .route("/moderation", ModerationRouter)
    .post("/update_region", validateParams(zUpdateRegionBody), (c) => {
        const { regionId, data } = c.req.valid("json");

        server.updateRegion(regionId, data);
        return c.json({}, 200);
    })
    .post("/set_game_mode", validateParams(zSetGameModeBody), (c) => {
        const {
            index,
            map_name: mapName,
            team_mode: teamMode,
            enabled,
        } = c.req.valid("json");

        if (!MapDefs[mapName as keyof typeof MapDefs]) {
            return c.json({ error: "Invalid map name" }, 400);
        }

        if (!server.modes[index]) {
            return c.json({ error: "Invalid mode index" }, 400);
        }

        server.modes[index] = {
            mapName: (mapName ?? server.modes[index].mapName) as keyof typeof MapDefs,
            teamMode: teamMode ?? server.modes[index].teamMode,
            enabled: enabled ?? server.modes[index].enabled,
        };

        saveConfig(serverConfigPath, {
            modes: server.modes,
        });

        return c.json(
            { message: `Set mode ${index} to ${JSON.stringify(server.modes[index])}` },
            200,
        );
    })
    .post("/set_client_theme", validateParams(zSetClientThemeBody), (c) => {
        const { theme } = c.req.valid("json");

        if (!MapDefs[theme as keyof typeof MapDefs]) {
            return c.json({ error: "Invalid map name" }, 400);
        }

        server.clientTheme = theme as keyof typeof MapDefs;

        saveConfig(serverConfigPath, {
            clientTheme: server.clientTheme,
        });

        return c.json({ message: `Set client theme to ${theme}` }, 200);
    })
    .post(
        "/toggle_captcha",
        validateParams(
            z.object({
                enabled: z.boolean(),
            }),
        ),
        (c) => {
            const { enabled } = c.req.valid("json");

            server.captchaEnabled = enabled;

            saveConfig(serverConfigPath, {
                captchaEnabled: enabled,
            });

            return c.json({ state: enabled }, 200);
        },
    )
    .post("/save_game", databaseEnabledMiddleware, async (c) => {
        const data = (await c.req.json()) as SaveGameBody;

        const matchData = data.matchData;

        if (!matchData.length) {
            return c.json({ error: "Empty match data" }, 400);
        }

        const gameIds = [...new Set(data.matchData.map((d) => d.gameId))];

        // i really don't want the game server to insert duplicated games by accident
        // when saving lost game data...
        const exists = await db
            .selectDistinct({
                gameId: matchDataTable.gameId,
            })
            .from(matchDataTable)
            .where(inArray(matchDataTable.gameId, gameIds));

        if (exists.length) {
            return c.json(
                {
                    error: `Games [${exists.map((d) => d.gameId).join(",")}] are already inserted`,
                },
                400,
            );
        }

        await leaderboardCache.invalidateCache(matchData);

        await db.insert(matchDataTable).values(matchData);
        await logPlayerIPs(matchData);

        // Update clan stats for players who are in clans
        await updateClanStats(matchData);

        server.logger.info(`Saved game data for ${matchData[0].gameId}`);
        return c.json({}, 200);
    })
    .post(
        "/quest_progress",
        databaseEnabledMiddleware,
        validateParams(
            z.object({
                userId: z.string(),
                progress: z
                    .array(
                        z.object({
                            id: z.string(),
                            delta: z.number().finite().positive(),
                        }),
                    )
                    .refine(
                        (entries) =>
                            new Set(entries.map((e) => e.id)).size === entries.length,
                        { message: "duplicate quest ids" },
                    ),
            }),
        ),
        async (c) => {
            const { userId, progress } = c.req.valid("json");

            if (progress.length === 0) {
                return c.json({ success: true }, 200);
            }

            const validEntries = progress
                .map((e) => ({ id: e.id, delta: Math.round(e.delta) }))
                .filter((e) => QuestDefs[e.id] && e.delta > 0);

            if (validEntries.length === 0) {
                return c.json({ success: true }, 200);
            }

            const userQuests = await db.query.userQuestTable.findMany({
                where: and(
                    eq(userQuestTable.userId, userId),
                    inArray(
                        userQuestTable.questType,
                        validEntries.map((e) => e.id),
                    ),
                ),
            });

            if (userQuests.length === 0) {
                return c.json({ success: true }, 200);
            }

            let xpGain = 0;

            const deltaById = new Map(validEntries.map((e) => [e.id, e.delta]));
            const passDef = PassDefs[passType];
            const now = Date.now();

            await db.transaction(async (tx) => {
                let pass = await tx.query.userPassTable.findFirst({
                    where: and(
                        eq(userPassTable.userId, userId),
                        eq(userPassTable.passType, passType),
                    ),
                });

                if (!pass) return;

                for (const quest of userQuests) {
                    const delta = deltaById.get(quest.questType) ?? 0;
                    if (delta <= 0) continue;

                    const def = QuestDefs[quest.questType];
                    if (!def) continue;
                    const nextProgress = Math.min(quest.target, quest.progress + delta);
                    const wasComplete = quest.complete;
                    const nowComplete = nextProgress >= quest.target;

                    if (!wasComplete && nowComplete) {
                        xpGain += def.xp;
                    }

                    if (nextProgress === quest.progress && wasComplete === nowComplete) {
                        continue;
                    }

                    await tx
                        .update(userQuestTable)
                        .set({
                            progress: nextProgress,
                            complete: nowComplete,
                        })
                        .where(eq(userQuestTable.id, quest.id));
                }

                if (xpGain <= 0) return;

                const oldTotalXp = pass.totalXp;
                const newTotalXp = oldTotalXp + xpGain;
                const oldLevel = passUtil.getPassLevelAndXp(passType, oldTotalXp).level;
                const newLevel = passUtil.getPassLevelAndXp(passType, newTotalXp).level;

                const unlockedRewards = passDef.items.filter(
                    (reward) => reward.level > oldLevel && reward.level <= newLevel,
                );
                const premiumUnlockedRewards = pass.unlocks?.[premiumPassUnlockType]
                    ? (passDef.premiumItems ?? []).filter(
                          (reward) => reward.level > oldLevel && reward.level <= newLevel,
                      )
                    : [];
                const unlockedRewardItems = unlockedRewards
                    .concat(premiumUnlockedRewards)
                    .flatMap((reward) => ("item" in reward ? [reward.item] : []))
                    .filter((item) => !!GameObjectDefs[item]);
                const passGpGain = unlockedRewards
                    .concat(premiumUnlockedRewards)
                    .reduce(
                        (total, reward) =>
                            total + ("gp" in reward ? (reward.gp ?? 0) : 0),
                        0,
                    );

                let unlockedNewItems = false;

                if (unlockedRewardItems.length > 0) {
                    const insertedRewards = await tx
                        .insert(itemsTable)
                        .values(
                            unlockedRewardItems.map((item) => ({
                                userId,
                                type: item,
                                source: passType,
                                timeAcquired: now,
                            })),
                        )
                        .onConflictDoNothing()
                        .returning({
                            type: itemsTable.type,
                        });

                    unlockedNewItems = insertedRewards.length > 0;
                }

                await tx
                    .insert(userPassTable)
                    .values({
                        userId,
                        passType,
                        totalXp: newTotalXp,
                        newItems: unlockedNewItems,
                    })
                    .onConflictDoUpdate({
                        target: [userPassTable.userId, userPassTable.passType],
                        set: {
                            totalXp: newTotalXp,
                            newItems: unlockedNewItems
                                ? true
                                : sql`${userPassTable.newItems}`,
                            updatedAt: new Date(),
                        },
                    });

                if (passGpGain > 0) {
                    await tx
                        .update(usersTable)
                        .set({
                            gpBalance: sql`${usersTable.gpBalance} + ${passGpGain}`,
                        })
                        .where(eq(usersTable.id, userId));
                }
            });

            return c.json({ success: true }, 200);
        },
    )
    .post(
        "/give_gp",
        databaseEnabledMiddleware,
        validateParams(zGiveGpParams),
        async (c) => {
            const { slug, value } = c.req.valid("json");

            const user = await db.query.usersTable.findFirst({
                where: eq(usersTable.slug, slug),
                columns: {
                    gpBalance: true,
                },
            });

            if (!user) {
                return c.json({ message: "User not found" }, 200);
            }

            const [updatedUser] = await db
                .update(usersTable)
                .set({
                    gpBalance: sql`${usersTable.gpBalance} + ${value}`,
                })
                .where(eq(usersTable.slug, slug))
                .returning({
                    gpBalance: usersTable.gpBalance,
                });

            return c.json(
                {
                    message: `Added ${value} GP to ${slug}. New balance: ${updatedUser?.gpBalance ?? user.gpBalance + value}`,
                },
                200,
            );
        },
    )
    .post(
        "/remove_gp",
        databaseEnabledMiddleware,
        validateParams(zRemoveGpParams),
        async (c) => {
            const { slug, value } = c.req.valid("json");

            const user = await db.query.usersTable.findFirst({
                where: eq(usersTable.slug, slug),
                columns: {
                    gpBalance: true,
                },
            });

            if (!user) {
                return c.json({ message: "User not found" }, 200);
            }

            const [updatedUser] = await db
                .update(usersTable)
                .set({
                    gpBalance: sql`GREATEST(${usersTable.gpBalance} - ${value}, 0)`,
                })
                .where(eq(usersTable.slug, slug))
                .returning({
                    gpBalance: usersTable.gpBalance,
                });

            return c.json(
                {
                    message: `Removed ${value} GP from ${slug}. New balance: ${updatedUser?.gpBalance ?? Math.max(0, user.gpBalance - value)}`,
                },
                200,
            );
        },
    )
    .post(
        "/get_gp",
        databaseEnabledMiddleware,
        validateParams(zGetGpParams),
        async (c) => {
            const { slug } = c.req.valid("json");

            const user = await db.query.usersTable.findFirst({
                where: eq(usersTable.slug, slug),
                columns: {
                    gpBalance: true,
                },
            });

            if (!user) {
                return c.json({ message: "User not found" }, 200);
            }

            return c.json({ message: `${slug} has ${user.gpBalance} GP` }, 200);
        },
    )
    .post(
        "/give_item",
        databaseEnabledMiddleware,
        validateParams(zGiveItemParams),
        async (c) => {
            const { item, slug, source } = c.req.valid("json");

            const def = GameObjectDefs[item];

            if (!def) {
                return c.json({ message: "Invalid item type" }, 200);
            }

            const userId = await db.query.usersTable.findFirst({
                where: eq(usersTable.slug, slug),
                columns: {
                    id: true,
                },
            });

            if (!userId) {
                return c.json({ message: "User not found" }, 200);
            }

            await db.insert(itemsTable).values({
                userId: userId.id,
                type: item,
                source,
                timeAcquired: Date.now(),
            });

            return c.json({ message: `Item "${item}" given to ${slug}` }, 200);
        },
    )
    .post(
        "/remove_item",
        databaseEnabledMiddleware,
        validateParams(zRemoveItemParams),
        async (c) => {
            const { item, slug } = c.req.valid("json");

            const user = await db.query.usersTable.findFirst({
                where: eq(usersTable.slug, slug),
                columns: {
                    id: true,
                },
            });

            if (!user) {
                return c.json({ message: "User not found" }, 200);
            }

            await db
                .delete(itemsTable)
                .where(and(eq(itemsTable.userId, user.id), eq(itemsTable.type, item)));

            return c.json({ message: `Item "${item}" removed from ${slug}` }, 200);
        },
    )
    .post("/clear_cache", async (c) => {
        const client = await getRedisClient();
        await client.flushAll();
        return c.json({ success: true }, 200);
    })
    .post(
        "/check_ip",
        validateParams(
            z.object({
                ip: z.string(),
            }),
        ),
        async (c) => {
            const { ip } = c.req.valid("json");

            const banData = await isBanned(ip, false);
            if (banData) {
                return c.json({ banned: true, banData: banData, behindProxy: false });
            }

            const isProxied = await isBehindProxy(ip, 0);
            if (isProxied) {
                return c.json({ banned: false, banData: undefined, behindProxy: true });
            }

            return c.json({ banned: false, banData: undefined, behindProxy: false });
        },
    )
    .post(
        "/test/insert_game",
        databaseEnabledMiddleware,
        validateParams(
            z.object({
                kills: z.number().default(1),
            }),
        ),
        async (c) => {
            const data = c.req.valid("json");
            const matchData: MatchDataTable = {
                ...{
                    gameId: crypto.randomUUID(),
                    userId: MOCK_USER_ID,
                    createdAt: new Date(),
                    region: "na",
                    mapId: 0,
                    mapSeed: 9834567801234,
                    username: MOCK_USER_ID,
                    playerId: 9834,
                    teamMode: TeamMode.Solo,
                    teamCount: 4,
                    teamTotal: 25,
                    teamId: 7,
                    timeAlive: 842,
                    rank: 3,
                    died: true,
                    kills: 5,
                    damageDealt: 1247,
                    damageTaken: 862,
                    killerId: 18765,
                    killedIds: [12543, 13587, 14298, 15321, 16754],
                },
                ...data,
            };
            await leaderboardCache.invalidateCache([matchData]);
            await db.insert(matchDataTable).values(matchData);
            return c.json({ success: true }, 200);
        },
    );

export type PrivateRouteApp = typeof PrivateRouter;
