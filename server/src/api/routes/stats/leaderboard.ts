import { and, count, eq, gte, inArray, ne, type SQL, sql } from "drizzle-orm";
import { Hono } from "hono";
import { MinGames } from "../../../../../shared/constants";
import { TeamMode } from "../../../../../shared/gameConfig";
import {
    type LeaderboardParams,
    type LeaderboardResponse,
    zLeaderboardsRequest,
} from "../../../../../shared/types/stats";
import type { Context } from "../..";
import { server } from "../../apiServer";
import {
    databaseEnabledMiddleware,
    rateLimitMiddleware,
    validateParams,
} from "../../auth/middleware";
import { leaderboardCache } from "../../cache/leaderboard";
import { db } from "../../db";
import { matchDataTable, usersTable } from "../../db/schema";

export const leaderboardRouter = new Hono<Context>();

leaderboardRouter.post(
    "/",
    databaseEnabledMiddleware,
    rateLimitMiddleware(40, 60 * 1000),
    validateParams(zLeaderboardsRequest),
    async (c) => {
        const params = c.req.valid("json");
        const { type, teamMode } = params;
        const cachedResult = await leaderboardCache.get(params);

        if (cachedResult) {
            server.logger.debug(
                `[CACHE HIT] -> ${leaderboardCache.getCacheKey("leaderboard", params)}`,
            );
            return c.json(cachedResult, 200);
        }

        const startTime = performance.now();
        const data =
            type === "most_kills" && teamMode != TeamMode.Solo
                ? await multiplePlayersQuery(params)
                : await soloLeaderboardQuery(params);
        logQueryPerformance(startTime, params);

        // TODO: decide if we should cache empty results;
        if (data.length != 0) {
            await leaderboardCache.set(params, data);
        }

        return c.json<LeaderboardResponse[]>(data, 200);
    },
);

// we don't use the one sent by the client lol.
const MAX_RESULT_COUNT = 100;

const typeToQuery: Record<LeaderboardParams["type"], string> = {
    kills: "SUM(match_data.kills)",
    most_damage_dealt: "MAX(match_data.damage_dealt)",
    kpg: "ROUND(SUM(match_data.kills) * 1.0 / COUNT(*), 1)",
    most_kills: "match_data.kills",
    wins: "COUNT(CASE WHEN match_data.rank = 1 THEN 1 END)",
};

const intervalFilter = {
    daily: gte(matchDataTable.createdAt, sql`NOW() - INTERVAL '1 day'`),
    weekly: gte(matchDataTable.createdAt, sql`NOW() - INTERVAL '7 days'`),
};

async function soloLeaderboardQuery(params: LeaderboardParams) {
    const { gameMode, interval, mapId, teamMode, type } = params;
    const minGames = type === "kpg" ? MinGames[type][interval] : 1;

    const aggregatedMatches = db.$with("player_matches").as(
        db
            .select({
                userId: matchDataTable.userId,
                username: matchDataTable.username,
                mapId: matchDataTable.mapId,
                region: matchDataTable.region,
                teamMode: matchDataTable.teamMode,
                gameMode: matchDataTable.gameMode,
                gameId: matchDataTable.gameId,
                kills: sql<number>`SUM(${matchDataTable.kills})`
                    .mapWith(Number)
                    .as("kills"),
                rank: sql<number>`MIN(${matchDataTable.rank})`.mapWith(Number).as("rank"),
                damageDealt: sql<number>`SUM(${matchDataTable.damageDealt})`
                    .mapWith(Number)
                    .as("damage_dealt"),
            })
            .from(matchDataTable)
            .where(
                and(
                    eq(matchDataTable.teamMode, teamMode),
                    eq(matchDataTable.gameMode, gameMode),
                    interval === "alltime" ? undefined : intervalFilter[interval],
                    ne(matchDataTable.userId, ""),
                    eq(matchDataTable.mapId, mapId),
                ),
            )
            .groupBy(
                matchDataTable.userId,
                matchDataTable.username,
                matchDataTable.mapId,
                matchDataTable.region,
                matchDataTable.teamMode,
                matchDataTable.gameMode,
                matchDataTable.gameId,
            ),
    );

    const usernameQuery =
        type === "most_kills" ? aggregatedMatches.username : usersTable.username;

    const result = await db
        .with(aggregatedMatches)
        .select({
            username: usernameQuery,
            mapId: aggregatedMatches.mapId,
            region: aggregatedMatches.region,
            teamMode: aggregatedMatches.teamMode,
            games: sql<number>`COUNT(*)`.mapWith(Number),
            slug: usersTable.slug,
            val: sql.raw(
                `${
                    {
                        kills: 'SUM("player_matches"."kills")',
                        most_damage_dealt: 'MAX("player_matches"."damage_dealt")',
                        kpg: 'ROUND(SUM("player_matches"."kills") * 1.0 / COUNT(*), 1)',
                        most_kills: 'MAX("player_matches"."kills")',
                        wins: 'COUNT(CASE WHEN "player_matches"."rank" = 1 THEN 1 END)',
                    }[type]
                } as val`,
            ) as SQL<number>,
        })
        .from(aggregatedMatches)
        .leftJoin(usersTable, eq(usersTable.id, aggregatedMatches.userId))
        .where(and(eq(usersTable.banned, false)))
        .groupBy(
            aggregatedMatches.mapId,
            usersTable.slug,
            aggregatedMatches.region,
            aggregatedMatches.teamMode,
            usernameQuery,
        )
        .having(sql`COUNT(*) >= ${minGames}`)
        .orderBy(sql`val DESC`)
        .limit(MAX_RESULT_COUNT);

    return result as LeaderboardResponse[];
}

async function multiplePlayersQuery({
    interval,
    gameMode,
    mapId,
    teamMode,
}: LeaderboardParams): Promise<LeaderboardResponse[]> {
    const data = await db
        .select({
            matchedUsers: sql<
                {
                    username: string;
                    userId: string | null;
                }[]
            >`json_agg(
                json_build_object(
                    'username', ${matchDataTable.username},
                    'userId', ${matchDataTable.userId}
                )
            )`,
            region: matchDataTable.region,
            val: sql<number>`SUM(${matchDataTable.kills}) as val`,
        })
        .from(matchDataTable)
        .where(
            and(
                interval === "alltime" ? undefined : intervalFilter[interval],
                eq(matchDataTable.userBanned, false),
                eq(matchDataTable.teamMode, teamMode),
                eq(matchDataTable.gameMode, gameMode),
                eq(matchDataTable.mapId, mapId),
            ),
        )
        .groupBy(matchDataTable.gameId, matchDataTable.teamId, matchDataTable.region)
        // make sure at least one member of the duo / squad is logged in
        .having(sql`count(case when user_id!='' then 1 end) >= 1`)
        .orderBy(sql`val DESC`)
        .limit(MAX_RESULT_COUNT);

    // get slugs using userIds
    // @NOTE: previously this was done in SQL using a join
    // but performance degraded significantly with larger table
    // splitting it into two separate queries is much faster

    const userIds: string[] = [];
    for (const row of data) {
        for (const { userId } of row.matchedUsers) {
            if (!userId) continue;
            userIds.push(userId);
        }
    }

    const slugsFromUserIds = await db
        .select({
            slug: usersTable.slug,
            id: usersTable.id,
        })
        .from(usersTable)
        .where(and(inArray(usersTable.id, userIds), eq(usersTable.banned, false)));

    const slugMap = Object.fromEntries(
        slugsFromUserIds.map(({ id, slug }) => [id, slug]),
    );

    return data.map((row) => {
        const usernames = [];
        const slugs = [];
        for (const { userId, username } of row.matchedUsers) {
            usernames.push(username);
            slugs.push(userId ? slugMap[userId] || null : null);
        }

        return {
            region: row.region,
            slugs,
            usernames,
            val: row.val,
        };
    }) satisfies LeaderboardResponse[];
}

function logQueryPerformance(startTime: number, params: LeaderboardParams) {
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    const timeString =
        executionTime > 1000
            ? `${(executionTime / 1000).toFixed(2)}s`
            : `${executionTime.toFixed(2)}ms`;
    server.logger[executionTime > 1000 ? "warn" : "debug"](
        `leaderboard | Execution time: ${timeString} | ${leaderboardCache.getCacheKey("debug" as any, params)}`,
    );
}
