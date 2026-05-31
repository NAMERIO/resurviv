import { and, count, eq, ne, sql, sum } from "drizzle-orm";
import { db } from "../../db";
import { matchDataTable, usersTable } from "../../db/schema";

export const getGlobalRank = async (userId: string): Promise<number> => {
    const playerMatches = db.$with("global_rank_player_matches").as(
        db
            .select({
                userId: matchDataTable.userId,
                gameId: matchDataTable.gameId,
                kills: sql<number>`SUM(${matchDataTable.kills})`
                    .mapWith(Number)
                    .as("kills"),
                rank: sql<number>`MIN(${matchDataTable.rank})`.mapWith(Number).as("rank"),
            })
            .from(matchDataTable)
            .where(ne(matchDataTable.userId, ""))
            .groupBy(matchDataTable.userId, matchDataTable.gameId),
    );

    const accountStats = db.$with("global_rank_account_stats").as(
        db
            .select({
                userId: playerMatches.userId,
                games: count().mapWith(Number).as("games"),
                wins: sql<number>`SUM(CASE WHEN ${playerMatches.rank} = 1 THEN 1 ELSE 0 END)`
                    .mapWith(Number)
                    .as("wins"),
                kills: sum(playerMatches.kills).mapWith(Number).as("kills"),
                score: sql<number>`COUNT(*) + COALESCE(SUM(${playerMatches.kills}), 0) * 10 + SUM(CASE WHEN ${playerMatches.rank} = 1 THEN 1 ELSE 0 END) * 100`
                    .mapWith(Number)
                    .as("score"),
            })
            .from(playerMatches)
            .groupBy(playerMatches.userId),
    );

    const rankedAccounts = db.$with("global_rank_accounts").as(
        db
            .select({
                userId: accountStats.userId,
                rank: sql<number>`ROW_NUMBER() OVER (
                    ORDER BY ${accountStats.score} DESC, ${accountStats.wins} DESC,
                    ${accountStats.kills} DESC, ${accountStats.games} DESC,
                    ${accountStats.userId} ASC
                )`
                    .mapWith(Number)
                    .as("rank"),
            })
            .from(accountStats)
            .innerJoin(usersTable, eq(usersTable.id, accountStats.userId))
            .where(and(eq(usersTable.banned, false))),
    );

    const result = await db
        .with(playerMatches, accountStats, rankedAccounts)
        .select({ rank: rankedAccounts.rank })
        .from(rankedAccounts)
        .where(eq(rankedAccounts.userId, userId))
        .limit(1);

    return result[0]?.rank ?? 0;
};
