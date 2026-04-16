import { and, desc, eq, gt, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { TeamMode } from "../../../../../shared/gameConfig";
import {
    ALL_TEAM_MODES,
    type MatchHistoryResponse,
    zMatchHistoryRequest,
} from "../../../../../shared/types/stats";
import { util } from "../../../../../shared/utils/util";
import type { Context } from "../..";
import {
    databaseEnabledMiddleware,
    rateLimitMiddleware,
    validateParams,
} from "../../auth/middleware";
import { db } from "../../db";
import { matchDataTable, usersTable } from "../../db/schema";

export const matchHistoryRouter = new Hono<Context>();

matchHistoryRouter.post(
    "/",
    databaseEnabledMiddleware,
    rateLimitMiddleware(40, 60 * 1000),
    validateParams(zMatchHistoryRequest),
    async (c) => {
        const { slug, offset, teamModeFilter } = c.req.valid("json");

        const result = await db.query.usersTable.findFirst({
            where: eq(usersTable.slug, slug),
            columns: {
                id: true,
            },
        });

        if (result?.id == undefined) {
            return c.json({}, 200);
        }

        const { id: userId } = result;
        const playerMatches = db.$with("player_matches").as(
            db
                .select({
                    guid: matchDataTable.gameId,
                    region: matchDataTable.region,
                    map_id: matchDataTable.mapId,
                    team_mode: matchDataTable.teamMode,
                    team_count: sql<number>`MAX(${matchDataTable.teamCount})`
                        .mapWith(Number)
                        .as("team_count"),
                    team_total: sql<number>`MAX(${matchDataTable.teamTotal})`
                        .mapWith(Number)
                        .as("team_total"),
                    end_time: sql<Date>`MAX(${matchDataTable.createdAt})`.as("end_time"),
                    time_alive: sql<number>`SUM(${matchDataTable.timeAlive})`
                        .mapWith(Number)
                        .as("time_alive"),
                    rank: sql<number>`MIN(${matchDataTable.rank})`.mapWith(Number).as("rank"),
                    kills: sql<number>`SUM(${matchDataTable.kills})`
                        .mapWith(Number)
                        .as("kills"),
                    team_id: sql<number>`MAX(${matchDataTable.teamId})`
                        .mapWith(Number)
                        .as("team_id"),
                    damage_dealt: sql<number>`SUM(${matchDataTable.damageDealt})`
                        .mapWith(Number)
                        .as("damage_dealt"),
                    damage_taken: sql<number>`SUM(${matchDataTable.damageTaken})`
                        .mapWith(Number)
                        .as("damage_taken"),
                })
                .from(matchDataTable)
                .where(
                    and(
                        eq(matchDataTable.userId, userId),
                        eq(matchDataTable.teamMode, teamModeFilter as TeamMode).if(
                            teamModeFilter != ALL_TEAM_MODES,
                        ),
                        gt(matchDataTable.createdAt, new Date(Date.now() - util.daysToMs(7))),
                    ),
                )
                .groupBy(
                    matchDataTable.gameId,
                    matchDataTable.region,
                    matchDataTable.mapId,
                    matchDataTable.teamMode,
                ),
        );
        const teamMatches = db.$with("team_matches").as(
            db
                .select({
                    guid: matchDataTable.gameId,
                    team_id: matchDataTable.teamId,
                    team_kills: sql<number>`SUM(${matchDataTable.kills})`
                        .mapWith(Number)
                        .as("team_kills"),
                })
                .from(matchDataTable)
                .groupBy(matchDataTable.gameId, matchDataTable.teamId),
        );
        const data = await db
            .with(playerMatches, teamMatches)
            .select({
                guid: playerMatches.guid,
                region: playerMatches.region,
                map_id: playerMatches.map_id,
                team_mode: playerMatches.team_mode,
                team_count: playerMatches.team_count,
                team_total: playerMatches.team_total,
                end_time: playerMatches.end_time,
                time_alive: playerMatches.time_alive,
                rank: playerMatches.rank,
                kills: playerMatches.kills,
                team_kills: teamMatches.team_kills,
                damage_dealt: playerMatches.damage_dealt,
                damage_taken: playerMatches.damage_taken,
                slug: sql<string>`${slug}`.as("slug"),
            })
            .from(playerMatches)
            .leftJoin(
                teamMatches,
                sql`"team_matches"."game_id" = "player_matches"."game_id"
                    AND "team_matches"."team_id" = "player_matches"."team_id"`,
            )
            .orderBy(desc(playerMatches.end_time))
            .offset(offset)
            .limit(10);

        return c.json<MatchHistoryResponse>(data);
    },
);
