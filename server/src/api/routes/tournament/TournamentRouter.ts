import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
    clearTournamentDescendants,
    createTournamentState,
    getTournamentPlayers,
    type TournamentState,
} from "../../../../../shared/types/tournament";
import { Config } from "../../../config";
import { authMiddleware, validateParams } from "../../auth/middleware";
import { db } from "../../db";
import type { Context } from "../../index";

export const TournamentRouter = new Hono<Context>();

async function ensureTournamentTable() {
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS tournament_bracket_state (
            id integer PRIMARY KEY,
            state jsonb NOT NULL,
            updated_at timestamptz NOT NULL DEFAULT now()
        )
    `);
    await db.execute(sql`
        INSERT INTO tournament_bracket_state (id, state)
        VALUES (1, ${JSON.stringify(createTournamentState())}::jsonb)
        ON CONFLICT (id) DO NOTHING
    `);
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS tournament_predictions (
            tournament_id integer NOT NULL DEFAULT 1,
            user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            match_id integer NOT NULL CHECK (match_id BETWEEN 0 AND 30),
            predicted_player text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (tournament_id, user_id, match_id)
        )
    `);
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS tournament_prediction_rewards (
            tournament_id integer NOT NULL DEFAULT 1,
            user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            gp_awarded integer NOT NULL DEFAULT 5000,
            awarded_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (tournament_id, user_id)
        )
    `);
}

const PERFECT_BRACKET_REWARD = 5000;

async function awardPerfectBrackets(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    state: TournamentState,
) {
    if (state.matches.some((match) => match.winner === null)) return;

    const result = await tx.execute<{
        user_id: string;
        match_id: number;
        predicted_player: string;
    }>(sql`
        SELECT user_id, match_id, predicted_player
        FROM tournament_predictions
        WHERE tournament_id = 1
        ORDER BY user_id, match_id
    `);
    const predictions = new Map<string, Map<number, string>>();
    for (const row of result.rows) {
        const picks = predictions.get(row.user_id) ?? new Map<number, string>();
        picks.set(Number(row.match_id), row.predicted_player);
        predictions.set(row.user_id, picks);
    }

    for (const [userId, picks] of predictions) {
        if (picks.size !== 31) continue;
        const perfect = state.matches.every((match, matchId) => {
            const players = getTournamentPlayers(state, matchId);
            return match.winner !== null && picks.get(matchId) === players[match.winner];
        });
        if (!perfect) continue;

        const inserted = await tx.execute<{ user_id: string }>(sql`
            INSERT INTO tournament_prediction_rewards
                (tournament_id, user_id, gp_awarded)
            VALUES (1, ${userId}, ${PERFECT_BRACKET_REWARD})
            ON CONFLICT (tournament_id, user_id) DO NOTHING
            RETURNING user_id
        `);
        if (inserted.rows.length) {
            await tx.execute(sql`
                UPDATE users
                SET gp_balance = gp_balance + ${PERFECT_BRACKET_REWARD}
                WHERE id = ${userId}
            `);
        }
    }
}

async function readState() {
    await ensureTournamentTable();
    const result = await db.execute<{
        state: TournamentState;
        updated_at: Date | string;
    }>(sql`
        SELECT state, updated_at FROM tournament_bracket_state WHERE id = 1
    `);
    const row = result.rows[0];
    if (!row) {
        throw new Error("Tournament bracket state could not be initialized");
    }
    return {
        ...row.state,
        updatedAt: new Date(row.updated_at).getTime(),
    } satisfies TournamentState;
}

TournamentRouter.get("/", async (c) => c.json(await readState()));

TournamentRouter.get("/permissions", authMiddleware, (c) => {
    const slug = c.get("user")!.slug;
    return c.json({ canEdit: Config.debug.developerSlugs.includes(slug) });
});

TournamentRouter.get("/predictions", authMiddleware, async (c) => {
    await ensureTournamentTable();
    const user = c.get("user")!;
    const result = await db.execute<{
        match_id: number;
        predicted_player: string;
    }>(sql`
        SELECT match_id, predicted_player
        FROM tournament_predictions
        WHERE tournament_id = 1 AND user_id = ${user.id}
        ORDER BY match_id
    `);
    const reward = await db.execute<{ gp_awarded: number }>(sql`
        SELECT gp_awarded
        FROM tournament_prediction_rewards
        WHERE tournament_id = 1 AND user_id = ${user.id}
    `);
    return c.json({
        predictions: result.rows.map((row) => ({
            matchId: Number(row.match_id),
            predictedPlayer: row.predicted_player,
        })),
        requiredPicks: 31,
        rewardGp: PERFECT_BRACKET_REWARD,
        rewarded: reward.rows.length > 0,
    });
});

TournamentRouter.get("/prediction-stats", async (c) => {
    await ensureTournamentTable();
    const state = await readState();
    const result = await db.execute<{
        match_id: number;
        predicted_player: string;
        votes: number | string;
    }>(sql`
        SELECT match_id, predicted_player, COUNT(*) AS votes
        FROM tournament_predictions
        WHERE tournament_id = 1
        GROUP BY match_id, predicted_player
        ORDER BY match_id, predicted_player
    `);

    const votes = new Map<string, number>();
    for (const row of result.rows) {
        votes.set(`${Number(row.match_id)}:${row.predicted_player}`, Number(row.votes));
    }

    return c.json({
        matches: state.matches.map((_match, matchId) => {
            const players = getTournamentPlayers(state, matchId);
            const playerVotes = players.map((player) =>
                player ? (votes.get(`${matchId}:${player}`) ?? 0) : 0,
            );
            return {
                matchId,
                players,
                votes: playerVotes,
                total: playerVotes[0] + playerVotes[1],
            };
        }),
    });
});

const predictionSchema = z.object({
    matchId: z.number().int().min(0).max(30),
    predictedPlayer: z.string().min(1).max(40),
});

TournamentRouter.post(
    "/prediction",
    authMiddleware,
    validateParams(predictionSchema),
    async (c) => {
        await ensureTournamentTable();
        const user = c.get("user")!;
        const prediction = c.req.valid("json");
        const result = await db.transaction(async (tx) => {
            const stateResult = await tx.execute<{ state: TournamentState }>(sql`
                SELECT state FROM tournament_bracket_state
                WHERE id = 1
                FOR UPDATE
            `);
            const state = stateResult.rows[0]?.state;
            if (!state)
                return { error: "Tournament is unavailable", status: 503 as const };
            if (state.matches[prediction.matchId].winner !== null) {
                return { error: "This match is already finished", status: 409 as const };
            }
            const players = getTournamentPlayers(state, prediction.matchId);
            if (!players[0] || !players[1]) {
                return { error: "This matchup is not ready yet", status: 409 as const };
            }
            if (!players.includes(prediction.predictedPlayer)) {
                return { error: "Choose a player in this matchup", status: 400 as const };
            }
            const inserted = await tx.execute(sql`
                INSERT INTO tournament_predictions
                    (tournament_id, user_id, match_id, predicted_player)
                VALUES (1, ${user.id}, ${prediction.matchId}, ${prediction.predictedPlayer})
                ON CONFLICT (tournament_id, user_id, match_id) DO NOTHING
                RETURNING match_id
            `);
            if (!inserted.rows.length) {
                return {
                    error: "Your prediction is already locked",
                    status: 409 as const,
                };
            }
            return { success: true as const };
        });
        if ("error" in result) return c.json({ error: result.error }, result.status);
        return c.json(result);
    },
);

const updateMatchSchema = z.object({
    matchId: z.number().int().min(0).max(30),
    scoreA: z.number().int().min(0).max(999).nullable(),
    scoreB: z.number().int().min(0).max(999).nullable(),
    winner: z.union([z.literal(0), z.literal(1)]).nullable(),
});

TournamentRouter.post(
    "/match",
    authMiddleware,
    validateParams(updateMatchSchema),
    async (c) => {
        const user = c.get("user")!;
        if (!Config.debug.developerSlugs.includes(user.slug)) {
            return c.json({ error: "Developer access required" }, 403);
        }

        const update = c.req.valid("json");
        await ensureTournamentTable();
        const state = await db.transaction(async (tx) => {
            const result = await tx.execute<{ state: TournamentState }>(sql`
                SELECT state FROM tournament_bracket_state WHERE id = 1 FOR UPDATE
            `);
            const nextState = result.rows[0]!.state;
            const players = getTournamentPlayers(nextState, update.matchId);
            if (update.winner !== null && !players[update.winner]) {
                throw new Error("That bracket slot has no player yet");
            }
            const oldWinner = nextState.matches[update.matchId].winner;
            nextState.matches[update.matchId] = {
                scoreA: update.scoreA,
                scoreB: update.scoreB,
                winner: update.winner,
            };
            if (oldWinner !== update.winner) {
                clearTournamentDescendants(nextState, update.matchId);
            }
            nextState.updatedAt = Date.now();
            await tx.execute(sql`
                UPDATE tournament_bracket_state
                SET state = ${JSON.stringify(nextState)}::jsonb, updated_at = now()
                WHERE id = 1
            `);
            await awardPerfectBrackets(tx, nextState);
            return nextState;
        });
        return c.json(state);
    },
);
