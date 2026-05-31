import { and, eq, gte, max, type SQL, sql, sum } from "drizzle-orm";
import { Hono } from "hono";
import {
    ALL_GAME_MODE_STATUS,
    ALL_MAPS,
    type Mode,
    type UserStatsRequest,
    type UserStatsResponse,
    zUserStatsRequest,
} from "../../../../../shared/types/stats";
import type { Context } from "../..";
import {
    databaseEnabledMiddleware,
    rateLimitMiddleware,
    validateParams,
} from "../../auth/middleware";
import { db } from "../../db";
import { matchDataTable, usersTable } from "../../db/schema";
import { getGlobalRank } from "./global_rank";

export const UserStatsRouter = new Hono<Context>();

/*
 * minimum data required for the ui to show the user doesn't exist
 */
const emptyState = {
    slug: "",
    username: "",
    modes: [],
};

UserStatsRouter.post(
    "/",
    databaseEnabledMiddleware,
    rateLimitMiddleware(40, 60 * 1000),
    validateParams(zUserStatsRequest),
    async (c) => {
        const { gameModeFilter, interval, mapIdFilter, slug } = c.req.valid("json");

        const result = await db.query.usersTable.findFirst({
            where: eq(usersTable.slug, slug),
            columns: {
                id: true,
                banned: true,
            },
        });

        if (!result) {
            return c.json(emptyState, 200);
        }

        const { id: userId } = result;

        const [data, globalRank] = await Promise.all([
            userStatsSqlQuery(userId, mapIdFilter, gameModeFilter, interval),
            getGlobalRank(userId),
        ]);

        return c.json<UserStatsResponse>({ ...data, global_rank: globalRank }, 200);
    },
);

const intervalFilter: Record<string, SQL<unknown>> = {
    daily: gte(matchDataTable.createdAt, sql`NOW() - INTERVAL '1 day'`),
    weekly: gte(matchDataTable.createdAt, sql`NOW() - INTERVAL '7 days'`),
};

async function userStatsSqlQuery(
    userId: string,
    mapIdFilter: string,
    gameModeFilter: UserStatsRequest["gameModeFilter"],
    interval: UserStatsRequest["interval"],
): Promise<UserStatsResponse> {
    const aggregatedMatches = db.$with("player_matches").as(
        db
            .select({
                team_mode: matchDataTable.teamMode,
                game_mode: matchDataTable.gameMode,
                game_id: matchDataTable.gameId,
                kills: sql<number>`SUM(${matchDataTable.kills})`
                    .mapWith(Number)
                    .as("kills"),
                rank: sql<number>`MIN(${matchDataTable.rank})`.mapWith(Number).as("rank"),
                damage_dealt: sql<number>`SUM(${matchDataTable.damageDealt})`
                    .mapWith(Number)
                    .as("damage_dealt"),
                time_alive: sql<number>`SUM(${matchDataTable.timeAlive})`
                    .mapWith(Number)
                    .as("time_alive"),
            })
            .from(matchDataTable)
            .where(
                and(
                    eq(matchDataTable.userId, userId),
                    mapIdFilter !== ALL_MAPS
                        ? eq(matchDataTable.mapId, parseInt(mapIdFilter))
                        : undefined,
                    gameModeFilter !== ALL_GAME_MODE_STATUS
                        ? eq(matchDataTable.gameMode, gameModeFilter)
                        : undefined,
                    interval in intervalFilter ? intervalFilter[interval] : undefined,
                ),
            )
            .groupBy(
                matchDataTable.teamMode,
                matchDataTable.gameMode,
                matchDataTable.gameId,
            ),
    );

    const withSelect = db.$with("mode_stats").as(
        db
            .select({
                team_mode: aggregatedMatches.team_mode,
                game_mode: aggregatedMatches.game_mode,
                games: sql`COUNT(*)`.as("games"),
                wins: sql`SUM(CASE WHEN ${aggregatedMatches.rank} = 1 THEN 1 ELSE 0 END)`.as(
                    "wins",
                ),
                kills: sum(aggregatedMatches.kills).as("kills"),
                winPct: sql`ROUND(SUM(CASE WHEN ${aggregatedMatches.rank} = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1)`.as(
                    "winpct",
                ),
                most_kills: max(aggregatedMatches.kills).as("most_kills"),
                most_damage: max(aggregatedMatches.damage_dealt).as("most_damage"),
                kpg: sql`ROUND(SUM(${aggregatedMatches.kills}) * 1.0 / COUNT(*), 1)`.as(
                    "kpg",
                ),
                avg_damage: sql`ROUND(AVG(${aggregatedMatches.damage_dealt}))`.as(
                    "avg_damage",
                ),
                avg_time_alive: sql`ROUND(AVG(${aggregatedMatches.time_alive}))`.as(
                    "avg_time_alive",
                ),
            })
            .from(aggregatedMatches)
            .groupBy(aggregatedMatches.team_mode, aggregatedMatches.game_mode),
    );

    const res = await db
        .with(aggregatedMatches, withSelect)
        .select({
            slug: usersTable.slug,
            username: usersTable.username,
            banned: usersTable.banned,
            player_icon: sql`JSON_EXTRACT_PATH(ANY_VALUE(${usersTable.loadout}), 'player_icon')`,
            games: sql`COALESCE(SUM("mode_stats".games), 0)`,
            wins: sql`COALESCE(SUM("mode_stats".wins), 0)`,
            kills: sql`COALESCE(SUM("mode_stats".kills), 0)`,
            kpg: sql`COALESCE(ROUND(SUM("mode_stats".kills) * 1.0 / NULLIF(SUM("mode_stats".games), 0), 1), 0)`,
            modes: sql`
        COALESCE(JSON_AGG(
            CASE WHEN "mode_stats".team_mode IS NOT NULL THEN
                JSON_BUILD_OBJECT(
                    'wins', "mode_stats".wins,
                    'kills', "mode_stats".kills,
                    'teamMode', "mode_stats".team_mode,
                    'gameMode', "mode_stats".game_mode,
                    'avgDamage', "mode_stats".avg_damage,
                    'avgTimeAlive', "mode_stats".avg_time_alive,
                    'mostDamage', "mode_stats".most_damage,
                    'kpg', "mode_stats".kpg,
                    'winPct', "mode_stats".winPct,
                    'mostKills', "mode_stats".most_kills,
                    'games', "mode_stats".games
                )
            END
        ), '[]')`,
        })
        .from(usersTable)
        .leftJoin(withSelect, eq(sql`1`, 1))
        .where(eq(usersTable.id, userId))
        .groupBy(usersTable.slug, usersTable.username, usersTable.banned)
        .limit(1);

    const userStats = res[0] as UserStatsResponse;

    if (!userStats || !userStats.slug) return emptyState as unknown as UserStatsResponse;

    const modes = userStats?.modes;
    const formatedData: UserStatsResponse = {
        ...userStats,
        // sql fuckery, it returns [null] where no result
        modes: modes[0] === null ? [] : normalizeStatsModes(modes),
    };
    return formatedData;
}

function normalizeStatsModes(modes: Mode[]): Mode[] {
    const modesByKey = new Map<string, Mode>();

    for (const mode of modes) {
        const teamMode = mode.teamMode > 4 ? 4 : mode.teamMode;
        const key = `${mode.gameMode}:${teamMode}`;
        const existing = modesByKey.get(key);

        if (!existing) {
            modesByKey.set(key, { ...mode, teamMode });
            continue;
        }

        const games = existing.games + mode.games;
        const wins = existing.wins + mode.wins;
        const kills = existing.kills + mode.kills;
        const totalDamage =
            existing.avgDamage * existing.games + mode.avgDamage * mode.games;
        const totalTimeAlive =
            existing.avgTimeAlive * existing.games + mode.avgTimeAlive * mode.games;

        existing.games = games;
        existing.wins = wins;
        existing.kills = kills;
        existing.winPct = games > 0 ? ((wins * 100) / games).toFixed(1) : "0";
        existing.mostKills = Math.max(existing.mostKills, mode.mostKills);
        existing.mostDamage = Math.max(existing.mostDamage, mode.mostDamage);
        existing.kpg = games > 0 ? (kills / games).toFixed(1) : "0";
        existing.avgDamage = games > 0 ? Math.round(totalDamage / games) : 0;
        existing.avgTimeAlive = games > 0 ? Math.round(totalTimeAlive / games) : 0;
    }

    return Array.from(modesByKey.values());
}
