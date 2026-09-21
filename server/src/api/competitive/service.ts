import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import {
    type CompetitiveBoard,
    WHR_SETTINGS,
    type zAddCompetitiveMatch,
    type zVoidCompetitiveMatch,
} from "../../../../shared/types/competitive";
import { db } from "../db";
import {
    competitiveMatchesTable as matches,
    competitiveSeasonsTable as seasons,
    usersTable,
} from "../db/schema";
import { summarizeCompetitivePlayers } from "./playerStats";
import { calculateWHR } from "./whr";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lockSeasonWrites(tx: Transaction) {
    // Serializes submissions, voids, and season changes across API processes.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(874231, 1)`);
}

async function currentSeason(tx: Transaction) {
    await lockSeasonWrites(tx);
    const [season] = await tx.select().from(seasons).orderBy(desc(seasons.id)).limit(1);
    if (season) return season;
    // Schema-only setup (e.g. drizzle push) does not run the migration's seed INSERT.
    const [initial] = await tx.insert(seasons).values({ name: "Season 1" }).returning();
    return initial;
}

async function ensureInitialSeason() {
    const [existing] = await db.select({ id: seasons.id }).from(seasons).limit(1);
    if (!existing) await db.transaction(currentSeason);
}

export async function getCompetitiveSeasons() {
    await ensureInitialSeason();
    return db
        .select({ id: seasons.id, name: seasons.name })
        .from(seasons)
        .orderBy(desc(seasons.id));
}

async function recalculate(tx: Transaction, seasonId: number) {
    const history = await tx
        .select()
        .from(matches)
        .where(and(eq(matches.seasonId, seasonId), isNull(matches.voidedAt)))
        .orderBy(asc(matches.playedOn), asc(matches.id));
    const ratings = await calculateWHR(
        history.map((match) => ({ ...match, scores: match.scores ?? undefined })),
    );
    await tx
        .update(seasons)
        .set({ ratings, updatedAt: new Date() })
        .where(eq(seasons.id, seasonId));
}

export async function validateCompetitivePlayers(
    slugs: string[],
    connection: Transaction | typeof db = db,
) {
    const users = await connection
        .select({ id: usersTable.id, slug: usersTable.slug, banned: usersTable.banned })
        .from(usersTable)
        .where(inArray(usersTable.slug, slugs));
    const bySlug = new Map(users.map((user) => [user.slug, user]));
    for (const slug of slugs) {
        const user = bySlug.get(slug);
        if (!user)
            throw new HTTPException(400, {
                message: `Incorrect slug: "${slug}" does not exist. Copy the exact account slug from the player's game profile URL.`,
            });
        if (user.banned)
            throw new HTTPException(400, {
                message: `Account "${slug}" is banned and cannot enter a rated match.`,
            });
    }
    return users;
}

export function addCompetitiveMatch(input: z.infer<typeof zAddCompetitiveMatch>) {
    return db.transaction(async (tx) => {
        const season = await currentSeason(tx);
        const [retried] = await tx
            .select()
            .from(matches)
            .where(eq(matches.requestId, input.requestId));
        if (retried)
            return { id: retried.id, reference: retried.reference, duplicate: true };
        const [duplicate] = await tx
            .select({ id: matches.id })
            .from(matches)
            .where(
                and(
                    eq(matches.seasonId, season.id),
                    eq(matches.reference, input.reference),
                    isNull(matches.voidedAt),
                ),
            );
        if (duplicate)
            throw new HTTPException(409, {
                message: `Reference already recorded as ${duplicate.id}. Void it before submitting a correction.`,
            });
        const [{ count }] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(matches)
            .where(and(eq(matches.seasonId, season.id), isNull(matches.voidedAt)));
        if (count >= 10000)
            throw new HTTPException(409, {
                message: "This season has reached 10,000 matches. Start a new season.",
            });
        const slugs = input.teams.flat();
        const users = await validateCompetitivePlayers(slugs, tx);
        const bySlug = new Map(users.map((user) => [user.slug, user]));
        const [match] = await tx
            .insert(matches)
            .values({
                seasonId: season.id,
                reference: input.reference,
                requestId: input.requestId,
                playedOn: input.playedOn,
                teams: input.teams.map((team) =>
                    team.map((slug) => bySlug.get(slug)!.id),
                ),
                slugs: input.teams,
                scores: input.scores ?? null,
                note: input.note,
                submittedBy: input.executorId,
            })
            .returning({ id: matches.id });
        await recalculate(tx, season.id);
        return { id: match.id, reference: input.reference, duplicate: false };
    });
}

export function voidCompetitiveMatch(input: z.infer<typeof zVoidCompetitiveMatch>) {
    return db.transaction(async (tx) => {
        await currentSeason(tx);
        const [match] = await tx
            .select()
            .from(matches)
            .where(eq(matches.id, input.matchId));
        if (!match) throw new HTTPException(404, { message: "Rated match not found." });
        if (match.voidedAt) return;
        await tx
            .update(matches)
            .set({
                voidedAt: new Date(),
                voidReason: input.reason,
                voidedBy: input.executorId,
            })
            .where(eq(matches.id, input.matchId));
        await recalculate(tx, match.seasonId);
    });
}

export function startCompetitiveSeason(name: string) {
    return db.transaction(async (tx) => {
        // An explicitly named first season should not also create a default season.
        await lockSeasonWrites(tx);
        const [season] = await tx
            .insert(seasons)
            .values({ name })
            .returning({ id: seasons.id, name: seasons.name });
        return season;
    });
}

export async function getCompetitiveBoard(
    seasonId?: number,
    matchOffset = 0,
): Promise<CompetitiveBoard> {
    // Seed before the read-only snapshot so this response can see the new season.
    await ensureInitialSeason();
    // The rating snapshot and history must describe the same committed state.
    return db.transaction(
        async (tx) => {
            const [season] = await tx
                .select()
                .from(seasons)
                .where(seasonId ? eq(seasons.id, seasonId) : undefined)
                .orderBy(desc(seasons.id))
                .limit(1);
            if (!season)
                throw new HTTPException(404, {
                    message: "Competitive season not found.",
                });
            const history = await tx
                .select()
                .from(matches)
                .where(eq(matches.seasonId, season.id))
                .orderBy(
                    desc(matches.playedOn),
                    desc(matches.createdAt),
                    desc(matches.id),
                )
                .limit(26)
                .offset(matchOffset);
            const ids = [
                ...new Set([
                    ...season.ratings.map((player) => player.userId),
                    ...history.flatMap((match) => match.teams.flat()),
                ]),
            ];
            const users = ids.length
                ? await tx
                      .select({
                          id: usersTable.id,
                          slug: usersTable.slug,
                          username: usersTable.username,
                          playerIcon: sql<
                              string | null
                          >`${usersTable.loadout}->>'player_icon'`,
                          banned: usersTable.banned,
                      })
                      .from(usersTable)
                      .where(inArray(usersTable.id, ids))
                : [];
            const byId = new Map(users.map((user) => [user.id, user]));
            const acceptedMatches = await tx
                .select({ teams: matches.teams, scores: matches.scores })
                .from(matches)
                .where(and(eq(matches.seasonId, season.id), isNull(matches.voidedAt)));
            const playerStats = summarizeCompetitivePlayers(acceptedMatches);
            let rank = 0;
            const players = season.ratings
                .flatMap((player) => {
                    const user = byId.get(player.userId);
                    if (!user || user.banned) return [];
                    return [
                        {
                            slug: user.slug,
                            username: user.username || user.slug,
                            playerIcon: user.playerIcon ?? "",
                            rating: Math.round(player.rating),
                            games: player.games,
                            stats: playerStats.get(player.userId) ?? {
                                wins: 0,
                                draws: 0,
                                losses: 0,
                                averagePlacement: 0,
                            },
                            rank:
                                player.games >= WHR_SETTINGS.placementGames
                                    ? ++rank
                                    : null,
                        },
                    ];
                })
                .sort(
                    (a, b) =>
                        Number(a.rank === null) - Number(b.rank === null) ||
                        b.rating - a.rating,
                );
            return {
                season: { id: season.id, name: season.name },
                updatedAt: season.updatedAt?.toISOString() ?? null,
                placementGames: WHR_SETTINGS.placementGames,
                players,
                matches: history.slice(0, 25).map((match) => ({
                    id: match.id,
                    reference: match.reference,
                    playedOn: match.playedOn,
                    teams: match.teams.map((team, i) =>
                        team.map((id, j) => byId.get(id)?.slug ?? match.slugs[i][j]),
                    ),
                    scores: match.scores,
                    note: match.note,
                    voidReason: match.voidReason,
                })),
                matchOffset,
                hasMoreMatches: history.length > 25,
            };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
    );
}
