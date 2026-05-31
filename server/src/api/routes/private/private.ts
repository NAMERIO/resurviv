import { randomInt } from "node:crypto";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { saveConfig } from "../../../../../config";
import { GameObjectDefs } from "../../../../../shared/defs/gameObjectDefs";
import { PassDefs } from "../../../../../shared/defs/gameObjects/passDefs";
import { QuestDefs } from "../../../../../shared/defs/gameObjects/questDefs";
import {
    isSideQuestType,
    SideQuestDefs,
    SideQuestRefreshCooldownMs,
} from "../../../../../shared/defs/gameObjects/sideQuestDefs";
import { MapDefs } from "../../../../../shared/defs/mapDefs";
import { TeamMode } from "../../../../../shared/gameConfig";
import { ClanConstants } from "../../../../../shared/types/clan";
import {
    zBlackjackCheckParams,
    zBlackjackResolveParams,
    zCoinFlipCheckParams,
    zCoinFlipResolveParams,
    zDiscordBalanceParams,
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
import { Config, serverConfigPath } from "../../../config";
import { isBehindProxy } from "../../../utils/serverHelpers";
import {
    type SaveGameBody,
    zAddClanWarCgpBody,
    zListFeaturedYoutubersBody,
    zListGameModesBody,
    zRemoveFeaturedYoutuberBody,
    zSetBattlePassEndBody,
    zSetBattleRoyaleModeBody,
    zSetClanCgpValueBody,
    zSetClientThemeBody,
    zSetGameModeBody,
    zSetPauseClanStatsBody,
    zUpdateRegionBody,
} from "../../../utils/types";
import type { Context } from "../..";
import { server, toBattleRoyaleMapName } from "../../apiServer";
import {
    databaseEnabledMiddleware,
    privateMiddleware,
    validateParams,
} from "../../auth/middleware";
import { getRedisClient } from "../../cache";
import { leaderboardCache } from "../../cache/leaderboard";
import { db } from "../../db";
import {
    clanMatchupHistoryTable,
    clanMemberStatsTable,
    clanMembersTable,
    clanSeasonMembersTable,
    clansTable,
    clanWarHistoryTable,
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

function getSurvivalKillCgpMultiplier(timeAlive: number) {
    if (timeAlive >= 5 * 60) return 1.25;
    if (timeAlive >= 3 * 60) return 1.15;
    if (timeAlive >= 2 * 60) return 1.1;
    return 1;
}

function getRepeatedMatchupMultiplier(matchNumber: number) {
    if (matchNumber <= 5) return 1;
    if (matchNumber <= 10) return 0.75;
    if (matchNumber <= 15) return 0.5;
    return 0.1;
}

function getLobbyCgpMultipliers(playerCount: number) {
    if (playerCount <= 3) {
        return { kills: 0.25, wins: 0.1 };
    }
    if (playerCount <= 6) {
        return { kills: 0.5, wins: 0.35 };
    }
    if (playerCount <= 9) {
        return { kills: 1, wins: 1 };
    }
    if (playerCount <= 12) {
        return { kills: 1.1, wins: 1.1 };
    }
    return { kills: 1.2, wins: 1.2 };
}

function toCgpMilli(value: number) {
    return Math.round(value * ClanConstants.CgpScale);
}

// Helper function to update clan stats for players who are in clans
async function updateClanStats(matchData: MatchDataTable[]) {
    if (Config.pauseClanStats) {
        server.logger.info("Clan stats are paused; skipping clan kill/win updates");
        return;
    }

    try {
        const aggregatedMatchData = new Map<
            string,
            {
                userId: string;
                gameId: string;
                teamId: number;
                createdAt: Date | string | undefined;
                gameMode: GameModeStatusType;
                kills: number;
                rank: number;
                timeAlive: number;
                playerCount: number;
            }
        >();
        const gamePlayerIds = new Map<string, Set<number>>();

        for (const data of matchData) {
            const gameId = String(data.gameId);
            let playerIds = gamePlayerIds.get(gameId);
            if (!playerIds) {
                playerIds = new Set();
                gamePlayerIds.set(gameId, playerIds);
            }
            playerIds.add(data.playerId);

            if (!data.userId) continue;

            const gameMode = data.gameMode ?? GameModeStatus.Deathmatch;
            const key = `${data.gameId}:${data.userId}:${gameMode}`;
            const existing = aggregatedMatchData.get(key);

            if (existing) {
                existing.kills += data.kills || 0;
                existing.rank = Math.min(existing.rank, data.rank || Infinity);
                existing.timeAlive = Math.max(existing.timeAlive, data.timeAlive || 0);
                existing.playerCount = Math.max(
                    existing.playerCount,
                    gamePlayerIds.get(gameId)?.size || 0,
                );
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
                gameId,
                teamId: data.teamId,
                createdAt: data.createdAt,
                gameMode,
                kills: data.kills || 0,
                rank: data.rank || Infinity,
                timeAlive: data.timeAlive || 0,
                playerCount: gamePlayerIds.get(gameId)?.size || 0,
            });
        }

        for (const data of aggregatedMatchData.values()) {
            data.playerCount = gamePlayerIds.get(data.gameId)?.size || data.playerCount;
        }

        const userIds = [
            ...new Set([...aggregatedMatchData.values()].map((d) => d.userId)),
        ];
        const memberships =
            userIds.length > 0
                ? await db
                      .select({
                          clanId: clanMembersTable.clanId,
                          userId: clanMembersTable.userId,
                          joinedAt: clanMembersTable.joinedAt,
                      })
                      .from(clanMembersTable)
                      .where(inArray(clanMembersTable.userId, userIds))
                : [];
        const membershipsByUserId = new Map(
            memberships.map((membership) => [membership.userId, membership]),
        );
        const gameTeamClans = new Map<string, Map<number, Set<string>>>();
        const validEntries: Array<{
            data: typeof aggregatedMatchData extends Map<string, infer T> ? T : never;
            membership: (typeof memberships)[number];
            matchTime: Date;
        }> = [];

        for (const data of aggregatedMatchData.values()) {
            const membership = membershipsByUserId.get(data.userId);

            if (!membership) continue;

            // Check if this match was played after the player joined the clan
            const matchTime =
                data.createdAt instanceof Date
                    ? data.createdAt
                    : new Date(data.createdAt!);
            if (matchTime < membership.joinedAt) continue;

            validEntries.push({ data, membership, matchTime });
            let teamClans = gameTeamClans.get(data.gameId);
            if (!teamClans) {
                teamClans = new Map();
                gameTeamClans.set(data.gameId, teamClans);
            }
            let clans = teamClans.get(data.teamId);
            if (!clans) {
                clans = new Set();
                teamClans.set(data.teamId, clans);
            }
            clans.add(membership.clanId);
        }

        const matchupMultiplierCache = new Map<string, number>();
        const getMatchupMultiplier = async (clanId: string, opponentClanId: string) => {
            const cacheKey = `${clanId}:${opponentClanId}`;
            const cached = matchupMultiplierCache.get(cacheKey);
            if (cached !== undefined) return cached;

            const [result] = await db
                .select({ count: count() })
                .from(clanMatchupHistoryTable)
                .where(
                    and(
                        eq(clanMatchupHistoryTable.clanId, clanId),
                        eq(clanMatchupHistoryTable.opponentClanId, opponentClanId),
                        eq(clanMatchupHistoryTable.season, ClanConstants.CurrentSeason),
                    ),
                );
            const multiplier = getRepeatedMatchupMultiplier((result?.count || 0) + 1);
            matchupMultiplierCache.set(cacheKey, multiplier);
            return multiplier;
        };

        for (const { data, membership } of validEntries) {
            await db
                .insert(clanSeasonMembersTable)
                .values({
                    clanId: membership.clanId,
                    userId: data.userId,
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

            // Update the clan member's stats
            const kills = data.kills || 0;
            const wins = data.rank === 1 ? 1 : 0;
            const opponentClanIds = new Set<string>();
            const teamClans = gameTeamClans.get(data.gameId);
            if (teamClans) {
                for (const [teamId, clans] of teamClans) {
                    if (teamId === data.teamId) continue;
                    for (const clanId of clans) {
                        if (clanId !== membership.clanId) {
                            opponentClanIds.add(clanId);
                        }
                    }
                }
            }
            const matchupMultipliers = await Promise.all(
                [...opponentClanIds].map((opponentClanId) =>
                    getMatchupMultiplier(membership.clanId, opponentClanId),
                ),
            );
            const matchupMultiplier =
                matchupMultipliers.length > 0 ? Math.min(...matchupMultipliers) : 1;
            const lobbyMultipliers = getLobbyCgpMultipliers(data.playerCount);
            const killCgpMilli = toCgpMilli(
                kills *
                    Config.clanCgp.killValue *
                    getSurvivalKillCgpMultiplier(data.timeAlive) *
                    matchupMultiplier *
                    lobbyMultipliers.kills,
            );
            const winCgpMilli = toCgpMilli(
                wins * Config.clanCgp.winValue * lobbyMultipliers.wins,
            );

            await db
                .insert(clanMemberStatsTable)
                .values({
                    clanId: membership.clanId,
                    userId: data.userId,
                    gameMode: data.gameMode,
                    season: ClanConstants.CurrentSeason,
                    kills,
                    wins,
                    killCgpMilli,
                    winCgpMilli,
                })
                .onConflictDoUpdate({
                    target: [
                        clanMemberStatsTable.clanId,
                        clanMemberStatsTable.userId,
                        clanMemberStatsTable.gameMode,
                        clanMemberStatsTable.season,
                    ],
                    set: {
                        kills: sql`${clanMemberStatsTable.kills} + ${kills}`,
                        wins: sql`${clanMemberStatsTable.wins} + ${wins}`,
                        killCgpMilli: sql`${clanMemberStatsTable.killCgpMilli} + ${killCgpMilli}`,
                        winCgpMilli: sql`${clanMemberStatsTable.winCgpMilli} + ${winCgpMilli}`,
                    },
                });
        }

        const matchupRows = new Map<
            string,
            {
                clanId: string;
                opponentClanId: string;
                gameId: string;
                season: number;
            }
        >();
        for (const [gameId, teamClans] of gameTeamClans) {
            for (const [teamId, clans] of teamClans) {
                for (const [opponentTeamId, opponentClans] of teamClans) {
                    if (teamId === opponentTeamId) continue;
                    for (const clanId of clans) {
                        for (const opponentClanId of opponentClans) {
                            if (clanId === opponentClanId) continue;
                            matchupRows.set(`${gameId}:${clanId}:${opponentClanId}`, {
                                clanId,
                                opponentClanId,
                                gameId,
                                season: ClanConstants.CurrentSeason,
                            });
                        }
                    }
                }
            }
        }
        if (matchupRows.size > 0) {
            await db
                .insert(clanMatchupHistoryTable)
                .values([...matchupRows.values()])
                .onConflictDoNothing();
        }
    } catch (err) {
        server.logger.error("Error updating clan stats:", err);
    }
}

type CoinFlipUser = {
    id: string;
    slug: string;
    username: string;
    gpBalance: number;
};

function findDiscordLinkedUser(discordId: string): Promise<CoinFlipUser | undefined> {
    return db.query.usersTable.findFirst({
        where: and(eq(usersTable.authId, discordId), eq(usersTable.linkedDiscord, true)),
        columns: {
            id: true,
            slug: true,
            username: true,
            gpBalance: true,
        },
    });
}

function toCoinFlipPlayer(user: CoinFlipUser) {
    return {
        slug: user.slug,
        username: user.username,
        gpBalance: user.gpBalance,
    };
}

async function changeClanWarCgp(c: any, operation: "add" | "remove") {
    const {
        clan: clanSearch,
        amount,
        opponent,
        result,
        executor_id: executorId,
    } = c.req.valid("json") as z.infer<typeof zAddClanWarCgpBody>;

    const [clan] = await db
        .select({
            id: clansTable.id,
            name: clansTable.name,
        })
        .from(clansTable)
        .where(
            sql`${clansTable.id}::text = ${clanSearch}
                OR ${clansTable.slug} ILIKE ${clanSearch}
                OR ${clansTable.name} ILIKE ${clanSearch}`,
        )
        .limit(1);

    if (!clan) {
        return c.json({ message: `Clan "${clanSearch}" not found` }, 200);
    }

    if (operation === "add") {
        const latestWar = await db.query.clanWarHistoryTable.findFirst({
            where: and(
                eq(clanWarHistoryTable.clanId, clan.id),
                sql`${clanWarHistoryTable.cgpAwarded} > 0`,
            ),
            orderBy: desc(clanWarHistoryTable.createdAt),
        });
        if (
            latestWar &&
            Date.now() - latestWar.createdAt.getTime() < 24 * 60 * 60 * 1000
        ) {
            const nextWarAt = new Date(
                latestWar.createdAt.getTime() + 24 * 60 * 60 * 1000,
            );
            return c.json(
                {
                    message: `${clan.name} already received clan war CGP in the last 24 hours. Next available: ${nextWarAt.toLocaleString("en-US")}`,
                },
                200,
            );
        }
    }

    const cgpAmount = operation === "remove" ? -amount : amount;

    await db.insert(clanWarHistoryTable).values({
        clanId: clan.id,
        season: ClanConstants.CurrentSeason,
        opponentClanName:
            opponent || (operation === "remove" ? "CGP Adjustment" : "Clan War"),
        result,
        cgpAwarded: cgpAmount,
        addedByDiscordId: executorId,
    });

    const action = operation === "remove" ? "Removed" : "Added";

    return c.json(
        {
            message: `${action} ${amount} CGP ${operation === "remove" ? "from" : "to"} ${clan.name} for clan war history.`,
        },
        200,
    );
}

function addClanWarCgp(c: any) {
    return changeClanWarCgp(c, "add");
}

function removeClanWarCgp(c: any) {
    return changeClanWarCgp(c, "remove");
}

const AvailableDeathmatchMapIds = [
    "main",
    "desert",
    "april_fools",
    "faction",
    "halloween",
    "gun_game",
    "snow",
    "woods",
    "cobalt",
    "perks",
    "valentine",
    "inferno",
] as const;

const AvailableDeathmatchMapIdSet = new Set<string>(AvailableDeathmatchMapIds);

function getTeamModeLabel(teamMode: TeamMode) {
    switch (teamMode) {
        case TeamMode.Solo:
            return "solo";
        case TeamMode.Duo:
            return "duo";
        case TeamMode.Squad:
            return "squad";
        case TeamMode.Ten:
            return "10";
        case TeamMode.Fifteen:
            return "15";
        default:
            return String(teamMode);
    }
}

function formatConfiguredMode(
    mode: (typeof Config.modes)[number],
    index: number,
    modeType: "deathmatch" | "br",
) {
    const mapName =
        modeType === "br" && mode.mapName.startsWith("br_")
            ? mode.mapName.slice(3)
            : mode.mapName;
    return `${index}: ${mapName} | team=${getTeamModeLabel(mode.teamMode)} (${mode.teamMode}) | ${mode.enabled ? "on" : "off"}`;
}

function getConfiguredModeSummary(
    mode: (typeof Config.modes)[number],
    index: number,
    modeType: "deathmatch" | "br",
) {
    const mapName =
        modeType === "br" && mode.mapName.startsWith("br_")
            ? mode.mapName.slice(3)
            : mode.mapName;
    return {
        index,
        mapName,
        teamMode: mode.teamMode,
        teamModeLabel: getTeamModeLabel(mode.teamMode),
        enabled: mode.enabled,
    };
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
            mode_type: modeType,
            map_name: requestedMapName,
            team_mode: teamMode,
            enabled,
        } = c.req.valid("json");
        const configuredModes = server.getConfiguredModes(modeType);

        if (!configuredModes[index]) {
            return c.json({ message: `Invalid ${modeType} mode index ${index}` }, 200);
        }

        let mapName = requestedMapName ?? configuredModes[index].mapName;

        if (modeType === "br") {
            mapName = mapName.startsWith("br_") ? mapName.slice(3) : mapName;
            if (!toBattleRoyaleMapName(mapName)) {
                return c.json(
                    { message: `Battle Royale does not have map "${mapName}"` },
                    200,
                );
            }
        } else if (!AvailableDeathmatchMapIdSet.has(mapName)) {
            return c.json({ message: `Deathmatch does not have map "${mapName}"` }, 200);
        }

        server.setMode(index, modeType, {
            mapName: mapName as keyof typeof MapDefs,
            teamMode: teamMode ?? configuredModes[index].teamMode,
            enabled: enabled ?? configuredModes[index].enabled,
        });

        saveConfig(serverConfigPath, {
            modes: Config.modes,
            br_modes: Config.br_modes,
        });

        return c.json(
            {
                message: `Set ${modeType} mode ${index} to ${JSON.stringify(
                    server.getConfiguredModes(modeType)[index],
                )}`,
            },
            200,
        );
    })
    .post("/list_game_modes", validateParams(zListGameModesBody), (c) => {
        const deathmatchMapIds = [...AvailableDeathmatchMapIds].sort();
        const battleRoyaleMapIds = Object.keys(MapDefs)
            .filter((mapName) => mapName.startsWith("br_"))
            .map((mapName) => mapName.slice(3))
            .sort();

        return c.json(
            {
                ok: true,
                battleRoyaleEnabled: Config.battleRoyaleMode,
                deathmatchModes: Config.modes.map((mode, index) =>
                    getConfiguredModeSummary(mode, index, "deathmatch"),
                ),
                battleRoyaleModes: Config.br_modes.map((mode, index) =>
                    getConfiguredModeSummary(mode, index, "br"),
                ),
                availableDeathmatchMapIds: deathmatchMapIds,
                availableBattleRoyaleMapIds: battleRoyaleMapIds,
                message: [
                    `Battle Royale global: ${Config.battleRoyaleMode ? "on" : "off"}`,
                    "",
                    "Deathmatch indexes:",
                    ...Config.modes.map((mode, index) =>
                        formatConfiguredMode(mode, index, "deathmatch"),
                    ),
                    "",
                    "Battle Royale indexes:",
                    ...Config.br_modes.map((mode, index) =>
                        formatConfiguredMode(mode, index, "br"),
                    ),
                    "",
                    `Available deathmatch map ids: ${deathmatchMapIds.join(", ")}`,
                    `Available battle royale map ids: ${battleRoyaleMapIds.join(", ")}`,
                ].join("\n"),
            },
            200,
        );
    })
    .post(
        "/set_battle_royale_mode",
        validateParams(zSetBattleRoyaleModeBody),
        async (c) => {
            const { enabled } = c.req.valid("json");

            await server.setBattleRoyaleMode(enabled);

            saveConfig(serverConfigPath, {
                battleRoyaleMode: enabled,
            });

            return c.json(
                {
                    message: `Battle Royale mode is now ${enabled ? "enabled" : "disabled"}`,
                },
                200,
            );
        },
    )
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
    .post("/set_pause_clan_stats", validateParams(zSetPauseClanStatsBody), (c) => {
        const { enabled } = c.req.valid("json");

        Config.pauseClanStats = enabled;

        saveConfig(serverConfigPath, {
            pauseClanStats: enabled,
        });

        return c.json(
            {
                message: `Clan stat tracking is now ${enabled ? "paused" : "enabled"}`,
            },
            200,
        );
    })
    .post("/battlepass_end", validateParams(zSetBattlePassEndBody), (c) => {
        const { days } = c.req.valid("json");
        const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        const endDateIso = endDate.toISOString();

        Config.battlePassEndDate = endDateIso;

        saveConfig(serverConfigPath, {
            battlePassEndDate: endDateIso,
        });

        return c.json(
            {
                message: `Battle pass season end set to ${endDateIso} (${days} day${days === 1 ? "" : "s"} from now).`,
            },
            200,
        );
    })
    .post("/futured-youtubers", validateParams(zListFeaturedYoutubersBody), (c) => {
        const youtubers = Config.featuredYoutubers;
        if (youtubers.length === 0) {
            return c.json({ message: "No featured YouTubers are configured." }, 200);
        }

        return c.json(
            {
                message: youtubers
                    .map(
                        (youtuber, index) =>
                            `${index + 1}. ${youtuber.name} - ${youtuber.link}`,
                    )
                    .join("\n"),
            },
            200,
        );
    })
    .post(
        "/remove-futured-youtubers",
        validateParams(zRemoveFeaturedYoutuberBody),
        (c) => {
            const { name } = c.req.valid("json");
            const normalizedName = name.toLowerCase();
            const previousLength = Config.featuredYoutubers.length;
            Config.featuredYoutubers = Config.featuredYoutubers.filter(
                (youtuber) => youtuber.name.toLowerCase() !== normalizedName,
            );

            if (Config.featuredYoutubers.length === previousLength) {
                return c.json(
                    { message: `No featured YouTuber found named "${name}".` },
                    200,
                );
            }

            saveConfig(serverConfigPath, {
                featuredYoutubers: Config.featuredYoutubers,
            });

            return c.json({ message: `Removed featured YouTuber "${name}".` }, 200);
        },
    )
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
                            delta: z.number().finite().min(0),
                            reset: z.boolean().optional(),
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
                .map((e) => ({
                    id: e.id,
                    delta: Math.round(e.delta),
                    reset: !!e.reset,
                }))
                .filter((e) => QuestDefs[e.id] && (e.delta > 0 || e.reset));

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
            let sideQuestGpGain = 0;

            const entryById = new Map(validEntries.map((e) => [e.id, e]));
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
                    const entry = entryById.get(quest.questType);
                    if (!entry) continue;

                    if (entry.reset && !quest.complete && quest.progress > 0) {
                        await tx
                            .update(userQuestTable)
                            .set({
                                progress: 0,
                                complete: false,
                            })
                            .where(eq(userQuestTable.id, quest.id));
                        continue;
                    }

                    const delta = entry.delta;
                    if (delta <= 0) continue;

                    const def = QuestDefs[quest.questType];
                    if (!def) continue;
                    const nextProgress = Math.min(quest.target, quest.progress + delta);
                    const wasComplete = quest.complete;
                    const nowComplete = nextProgress >= quest.target;

                    if (
                        !wasComplete &&
                        nowComplete &&
                        !isSideQuestType(quest.questType)
                    ) {
                        xpGain += def.xp;
                    }
                    if (!wasComplete && nowComplete && isSideQuestType(quest.questType)) {
                        sideQuestGpGain += SideQuestDefs[quest.questType].gp;
                    }

                    if (nextProgress === quest.progress && wasComplete === nowComplete) {
                        continue;
                    }

                    await tx
                        .update(userQuestTable)
                        .set({
                            progress: nextProgress,
                            complete: nowComplete,
                            nextRefreshAt:
                                !wasComplete &&
                                nowComplete &&
                                isSideQuestType(quest.questType)
                                    ? now + SideQuestRefreshCooldownMs
                                    : quest.nextRefreshAt,
                        })
                        .where(eq(userQuestTable.id, quest.id));
                }

                if (sideQuestGpGain > 0) {
                    await tx
                        .update(usersTable)
                        .set({
                            gpBalance: sql`${usersTable.gpBalance} + ${sideQuestGpGain}`,
                        })
                        .where(eq(usersTable.id, userId));
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
    .post("/gp_leaderboard", databaseEnabledMiddleware, async (c) => {
        const players = await db
            .select({
                slug: usersTable.slug,
                username: usersTable.username,
                gpBalance: usersTable.gpBalance,
            })
            .from(usersTable)
            .where(sql`${usersTable.gpBalance} > 0`)
            .orderBy(desc(usersTable.gpBalance), usersTable.slug)
            .limit(10);

        return c.json({ ok: true, players }, 200);
    })
    .post(
        "/addcgp",
        databaseEnabledMiddleware,
        validateParams(zAddClanWarCgpBody),
        addClanWarCgp,
    )
    .post(
        "/clanwarcgp",
        databaseEnabledMiddleware,
        validateParams(zAddClanWarCgpBody),
        addClanWarCgp,
    )
    .post(
        "/add_cgp",
        databaseEnabledMiddleware,
        validateParams(zAddClanWarCgpBody),
        addClanWarCgp,
    )
    .post(
        "/removecgp",
        databaseEnabledMiddleware,
        validateParams(zAddClanWarCgpBody),
        removeClanWarCgp,
    )
    .post(
        "/remove_cgp",
        databaseEnabledMiddleware,
        validateParams(zAddClanWarCgpBody),
        removeClanWarCgp,
    )
    .post(
        "/clanwar_cgp",
        databaseEnabledMiddleware,
        validateParams(zAddClanWarCgpBody),
        addClanWarCgp,
    )
    .post("/setkillcgp", validateParams(zSetClanCgpValueBody), (c) => {
        const { value } = c.req.valid("json");
        Config.clanCgp.killValue = value;
        saveConfig(serverConfigPath, {
            clanCgp: {
                killValue: value,
            },
        });
        return c.json({ message: `Kill CGP value set to ${value}` }, 200);
    })
    .post("/setwincgp", validateParams(zSetClanCgpValueBody), (c) => {
        const { value } = c.req.valid("json");
        Config.clanCgp.winValue = value;
        saveConfig(serverConfigPath, {
            clanCgp: {
                winValue: value,
            },
        });
        return c.json({ message: `Win CGP value set to ${value}` }, 200);
    })
    .post(
        "/coinflip_check",
        databaseEnabledMiddleware,
        validateParams(zCoinFlipCheckParams),
        async (c) => {
            const {
                challenger_discord_id: challengerDiscordId,
                opponent_discord_id: opponentDiscordId,
                bet,
            } = c.req.valid("json");

            if (challengerDiscordId === opponentDiscordId) {
                return c.json(
                    {
                        ok: false,
                        reason: "same_user",
                        message: "You cannot coinflip against yourself.",
                    },
                    200,
                );
            }

            const challenger = await findDiscordLinkedUser(challengerDiscordId);
            if (!challenger) {
                return c.json(
                    {
                        ok: false,
                        reason: "challenger_not_connected",
                        message:
                            "You do not have a game account connected to this Discord.",
                    },
                    200,
                );
            }

            if (challenger.gpBalance < bet) {
                return c.json(
                    {
                        ok: false,
                        reason: "challenger_not_enough_gp",
                        message: "You do not have enough GP.",
                    },
                    200,
                );
            }

            const opponent = await findDiscordLinkedUser(opponentDiscordId);
            if (!opponent) {
                return c.json(
                    {
                        ok: false,
                        reason: "opponent_not_connected",
                        message:
                            "User does not have a game account connected to this Discord.",
                    },
                    200,
                );
            }

            if (opponent.gpBalance < bet) {
                return c.json(
                    {
                        ok: false,
                        reason: "opponent_not_enough_gp",
                        message: "User does not have enough GP.",
                    },
                    200,
                );
            }

            return c.json(
                {
                    ok: true,
                    challenger: toCoinFlipPlayer(challenger),
                    opponent: toCoinFlipPlayer(opponent),
                },
                200,
            );
        },
    )
    .post(
        "/blackjack_check",
        databaseEnabledMiddleware,
        validateParams(zBlackjackCheckParams),
        async (c) => {
            const {
                challenger_discord_id: challengerDiscordId,
                opponent_discord_id: opponentDiscordId,
                bet,
            } = c.req.valid("json");

            if (challengerDiscordId === opponentDiscordId) {
                return c.json(
                    {
                        ok: false,
                        reason: "same_user",
                        message: "You cannot play blackjack against yourself.",
                    },
                    200,
                );
            }

            const challenger = await findDiscordLinkedUser(challengerDiscordId);
            if (!challenger) {
                return c.json(
                    {
                        ok: false,
                        reason: "challenger_not_connected",
                        message:
                            "You do not have a game account connected to this Discord.",
                    },
                    200,
                );
            }

            if (challenger.gpBalance < bet) {
                return c.json(
                    {
                        ok: false,
                        reason: "challenger_not_enough_gp",
                        message: "You do not have enough GP.",
                    },
                    200,
                );
            }

            const opponent = await findDiscordLinkedUser(opponentDiscordId);
            if (!opponent) {
                return c.json(
                    {
                        ok: false,
                        reason: "opponent_not_connected",
                        message:
                            "User does not have a game account connected to this Discord.",
                    },
                    200,
                );
            }

            if (opponent.gpBalance < bet) {
                return c.json(
                    {
                        ok: false,
                        reason: "opponent_not_enough_gp",
                        message: "User does not have enough GP.",
                    },
                    200,
                );
            }

            return c.json(
                {
                    ok: true,
                    challenger: toCoinFlipPlayer(challenger),
                    opponent: toCoinFlipPlayer(opponent),
                },
                200,
            );
        },
    )
    .post(
        "/blackjack_resolve",
        databaseEnabledMiddleware,
        validateParams(zBlackjackResolveParams),
        async (c) => {
            const {
                challenger_discord_id: challengerDiscordId,
                opponent_discord_id: opponentDiscordId,
                winner_discord_id: winnerDiscordId,
                loser_discord_id: loserDiscordId,
                bet,
            } = c.req.valid("json");

            if (challengerDiscordId === opponentDiscordId) {
                return c.json(
                    {
                        ok: false,
                        reason: "same_user",
                        message: "You cannot play blackjack against yourself.",
                    },
                    200,
                );
            }

            const expectedPlayers = new Set([challengerDiscordId, opponentDiscordId]);
            if (
                !expectedPlayers.has(winnerDiscordId) ||
                !expectedPlayers.has(loserDiscordId) ||
                winnerDiscordId === loserDiscordId
            ) {
                return c.json(
                    {
                        ok: false,
                        reason: "invalid_winner",
                        message: "Invalid blackjack winner.",
                    },
                    200,
                );
            }

            const result = await db.transaction(async (tx) => {
                const winner = await tx.query.usersTable.findFirst({
                    where: and(
                        eq(usersTable.authId, winnerDiscordId),
                        eq(usersTable.linkedDiscord, true),
                    ),
                    columns: {
                        id: true,
                        slug: true,
                        username: true,
                        gpBalance: true,
                    },
                });

                if (!winner) {
                    return {
                        ok: false,
                        reason: "winner_not_connected",
                        message: "Winner does not have a connected game account.",
                    };
                }

                const loser = await tx.query.usersTable.findFirst({
                    where: and(
                        eq(usersTable.authId, loserDiscordId),
                        eq(usersTable.linkedDiscord, true),
                    ),
                    columns: {
                        id: true,
                        slug: true,
                        username: true,
                        gpBalance: true,
                    },
                });

                if (!loser) {
                    return {
                        ok: false,
                        reason: "loser_not_connected",
                        message: "Loser does not have a connected game account.",
                    };
                }

                if (winner.gpBalance < bet || loser.gpBalance < bet) {
                    return {
                        ok: false,
                        reason: "not_enough_gp",
                        message: "One player does not have enough GP.",
                    };
                }

                const [updatedLoser] = await tx
                    .update(usersTable)
                    .set({
                        gpBalance: sql`${usersTable.gpBalance} - ${bet}`,
                    })
                    .where(
                        and(
                            eq(usersTable.id, loser.id),
                            sql`${usersTable.gpBalance} >= ${bet}`,
                        ),
                    )
                    .returning({
                        gpBalance: usersTable.gpBalance,
                    });

                if (!updatedLoser) {
                    return {
                        ok: false,
                        reason: "loser_not_enough_gp",
                        message: "Loser does not have enough GP.",
                    };
                }

                const [updatedWinner] = await tx
                    .update(usersTable)
                    .set({
                        gpBalance: sql`${usersTable.gpBalance} + ${bet}`,
                    })
                    .where(eq(usersTable.id, winner.id))
                    .returning({
                        gpBalance: usersTable.gpBalance,
                    });

                return {
                    ok: true,
                    bet,
                    winner: {
                        ...toCoinFlipPlayer(winner),
                        gpBalance: updatedWinner?.gpBalance ?? winner.gpBalance + bet,
                    },
                    loser: {
                        ...toCoinFlipPlayer(loser),
                        gpBalance: updatedLoser.gpBalance,
                    },
                };
            });

            return c.json(result, 200);
        },
    )
    .post(
        "/discord_balance",
        databaseEnabledMiddleware,
        validateParams(zDiscordBalanceParams),
        async (c) => {
            const { discord_id: discordId } = c.req.valid("json");
            const user = await findDiscordLinkedUser(discordId);

            if (!user) {
                return c.json(
                    {
                        ok: false,
                        message:
                            "This Discord account is not connected to any game account.",
                    },
                    200,
                );
            }

            return c.json(
                {
                    ok: true,
                    player: toCoinFlipPlayer(user),
                },
                200,
            );
        },
    )
    .post(
        "/coinflip_resolve",
        databaseEnabledMiddleware,
        validateParams(zCoinFlipResolveParams),
        async (c) => {
            const {
                challenger_discord_id: challengerDiscordId,
                opponent_discord_id: opponentDiscordId,
                bet,
                opponent_pick: opponentPick,
            } = c.req.valid("json");

            if (challengerDiscordId === opponentDiscordId) {
                return c.json(
                    {
                        ok: false,
                        reason: "same_user",
                        message: "You cannot coinflip against yourself.",
                    },
                    200,
                );
            }

            const result = await db.transaction(async (tx) => {
                const challenger = await tx.query.usersTable.findFirst({
                    where: and(
                        eq(usersTable.authId, challengerDiscordId),
                        eq(usersTable.linkedDiscord, true),
                    ),
                    columns: {
                        id: true,
                        slug: true,
                        username: true,
                        gpBalance: true,
                    },
                });

                if (!challenger) {
                    return {
                        ok: false,
                        reason: "challenger_not_connected",
                        message:
                            "You do not have a game account connected to this Discord.",
                    };
                }

                const opponent = await tx.query.usersTable.findFirst({
                    where: and(
                        eq(usersTable.authId, opponentDiscordId),
                        eq(usersTable.linkedDiscord, true),
                    ),
                    columns: {
                        id: true,
                        slug: true,
                        username: true,
                        gpBalance: true,
                    },
                });

                if (!opponent) {
                    return {
                        ok: false,
                        reason: "opponent_not_connected",
                        message:
                            "User does not have a game account connected to this Discord.",
                    };
                }

                if (challenger.gpBalance < bet) {
                    return {
                        ok: false,
                        reason: "challenger_not_enough_gp",
                        message: "You do not have enough GP.",
                    };
                }

                if (opponent.gpBalance < bet) {
                    return {
                        ok: false,
                        reason: "opponent_not_enough_gp",
                        message: "User does not have enough GP.",
                    };
                }

                const coinResult = randomInt(2) === 0 ? "heads" : "tails";
                const opponentWins = opponentPick === coinResult;
                const winner = opponentWins ? opponent : challenger;
                const loser = opponentWins ? challenger : opponent;

                const [updatedLoser] = await tx
                    .update(usersTable)
                    .set({
                        gpBalance: sql`${usersTable.gpBalance} - ${bet}`,
                    })
                    .where(
                        and(
                            eq(usersTable.id, loser.id),
                            sql`${usersTable.gpBalance} >= ${bet}`,
                        ),
                    )
                    .returning({
                        gpBalance: usersTable.gpBalance,
                    });

                if (!updatedLoser) {
                    return {
                        ok: false,
                        reason:
                            loser.id === challenger.id
                                ? "challenger_not_enough_gp"
                                : "opponent_not_enough_gp",
                        message:
                            loser.id === challenger.id
                                ? "You do not have enough GP."
                                : "User does not have enough GP.",
                    };
                }

                const [updatedWinner] = await tx
                    .update(usersTable)
                    .set({
                        gpBalance: sql`${usersTable.gpBalance} + ${bet}`,
                    })
                    .where(eq(usersTable.id, winner.id))
                    .returning({
                        gpBalance: usersTable.gpBalance,
                    });

                return {
                    ok: true,
                    bet,
                    coinResult,
                    opponentPick,
                    winner: {
                        ...toCoinFlipPlayer(winner),
                        gpBalance: updatedWinner?.gpBalance ?? winner.gpBalance + bet,
                    },
                    loser: {
                        ...toCoinFlipPlayer(loser),
                        gpBalance: updatedLoser.gpBalance,
                    },
                };
            });

            return c.json(result, 200);
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
