import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
    clearTournamentDescendants,
    createTournamentState,
    getTournamentBetMarkets,
    getTournamentDescendantMatchIds,
    getTournamentPlayers,
    type TournamentBet,
    TournamentBetLimits,
    type TournamentBetMarketId,
    TournamentFinalMatchId,
    type TournamentState,
} from "../../../../../shared/types/tournament";
import { Config } from "../../../config";
import { logTournamentBetToDiscord } from "../../../utils/tournamentBetLogging";
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
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS tournament_bets (
            id serial PRIMARY KEY,
            tournament_id integer NOT NULL DEFAULT 1,
            user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            match_id integer NOT NULL,
            market text NOT NULL,
            selection text NOT NULL,
            odds_hundredths integer NOT NULL CHECK (odds_hundredths BETWEEN 100 AND 500),
            amount integer NOT NULL CHECK (amount BETWEEN 250 AND 2500),
            status text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'won', 'lost')),
            payout integer NOT NULL DEFAULT 0,
            created_at timestamptz NOT NULL DEFAULT now(),
            settled_at timestamptz,
            UNIQUE (tournament_id, user_id, match_id, market)
        )
    `);
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS tournament_bet_settlements (
            tournament_id integer NOT NULL DEFAULT 1,
            match_id integer NOT NULL,
            grenade_kills integer NOT NULL CHECK (grenade_kills >= 0),
            heal_off boolean NOT NULL,
            settled_by text NOT NULL REFERENCES users(id),
            settled_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (tournament_id, match_id)
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

type TournamentBetRow = {
    market: TournamentBetMarketId;
    selection: string;
    odds_hundredths: number;
    amount: number;
    status: TournamentBet["status"];
    payout: number;
};

function serializeBet(row: TournamentBetRow): TournamentBet {
    return {
        market: row.market,
        selection: row.selection,
        oddsHundredths: Number(row.odds_hundredths),
        amount: Number(row.amount),
        status: row.status,
        payout: Number(row.payout),
    };
}

TournamentRouter.get("/betting", authMiddleware, async (c) => {
    await ensureTournamentTable();
    const user = c.get("user")!;
    const state = await readState();
    const players = getTournamentPlayers(state, TournamentFinalMatchId);
    const [balanceResult, betsResult, settlementResult] = await Promise.all([
        db.execute<{ gp_balance: number }>(sql`
            SELECT gp_balance FROM users WHERE id = ${user.id}
        `),
        db.execute<TournamentBetRow>(sql`
            SELECT market, selection, odds_hundredths, amount, status, payout
            FROM tournament_bets
            WHERE tournament_id = 1
                AND user_id = ${user.id}
                AND match_id = ${TournamentFinalMatchId}
            ORDER BY id
        `),
        db.execute<{ settled_at: Date | string }>(sql`
            SELECT settled_at
            FROM tournament_bet_settlements
            WHERE tournament_id = 1 AND match_id = ${TournamentFinalMatchId}
        `),
    ]);

    return c.json({
        matchId: TournamentFinalMatchId,
        players,
        balance: Number(balanceResult.rows[0]?.gp_balance ?? 0),
        limits: TournamentBetLimits,
        open:
            Boolean(players[0] && players[1]) &&
            state.matches[TournamentFinalMatchId].winner === null,
        settled: settlementResult.rows.length > 0,
        bets: betsResult.rows.map(serializeBet),
    });
});

const betSchema = z.object({
    market: z.enum(["winner", "margin", "game_11", "grenade_kills", "heal_off"]),
    selection: z.string().min(1).max(40),
    amount: z
        .number()
        .int()
        .min(TournamentBetLimits.minimum)
        .max(TournamentBetLimits.maximum),
});

TournamentRouter.post("/bet", authMiddleware, validateParams(betSchema), async (c) => {
    await ensureTournamentTable();
    const user = c.get("user")!;
    const bet = c.req.valid("json");
    const result = await db.transaction(async (tx) => {
        const stateResult = await tx.execute<{ state: TournamentState }>(sql`
                SELECT state
                FROM tournament_bracket_state
                WHERE id = 1
                FOR UPDATE
            `);
        const state = stateResult.rows[0]?.state;
        if (!state) {
            return { error: "Tournament betting is unavailable", status: 503 as const };
        }

        const players = getTournamentPlayers(state, TournamentFinalMatchId);
        if (!players[0] || !players[1]) {
            return { error: "The final matchup is not ready yet", status: 409 as const };
        }
        if (state.matches[TournamentFinalMatchId].winner !== null) {
            return { error: "Betting is closed for this match", status: 409 as const };
        }

        const market = getTournamentBetMarkets(players).find(
            (candidate) => candidate.id === bet.market,
        );
        const option = market?.options.find(
            (candidate) => candidate.id === bet.selection,
        );
        if (!market || !option) {
            return { error: "Choose a valid betting option", status: 400 as const };
        }

        const userResult = await tx.execute<{ gp_balance: number }>(sql`
                SELECT gp_balance FROM users WHERE id = ${user.id} FOR UPDATE
            `);
        const balance = Number(userResult.rows[0]?.gp_balance ?? 0);
        if (balance < bet.amount) {
            return { error: "You do not have enough GP", status: 409 as const };
        }

        const existing = await tx.execute(sql`
                SELECT id
                FROM tournament_bets
                WHERE tournament_id = 1
                    AND user_id = ${user.id}
                    AND match_id = ${TournamentFinalMatchId}
                    AND market = ${bet.market}
            `);
        if (existing.rows.length) {
            return {
                error: "You already placed a bet in this category",
                status: 409 as const,
            };
        }

        await tx.execute(sql`
                INSERT INTO tournament_bets
                    (tournament_id, user_id, match_id, market, selection,
                     odds_hundredths, amount)
                VALUES
                    (1, ${user.id}, ${TournamentFinalMatchId}, ${bet.market},
                     ${bet.selection}, ${option.oddsHundredths}, ${bet.amount})
            `);
        const updated = await tx.execute<{ gp_balance: number }>(sql`
                UPDATE users
                SET gp_balance = gp_balance - ${bet.amount}
                WHERE id = ${user.id}
                RETURNING gp_balance
            `);
        return {
            success: true as const,
            balance: Number(updated.rows[0]!.gp_balance),
            market: market.title,
            selection: option.label,
            oddsHundredths: option.oddsHundredths,
        };
    });

    if ("error" in result) return c.json({ error: result.error }, result.status);
    void logTournamentBetToDiscord({
        username: user.username,
        slug: user.slug,
        market: result.market,
        selection: result.selection,
        oddsHundredths: result.oddsHundredths,
        amount: bet.amount,
        balance: result.balance,
    });
    return c.json({ success: result.success, balance: result.balance });
});

const settleBetsSchema = z.object({
    grenadeKills: z.number().int().min(0).max(999),
    healOff: z.boolean(),
});

TournamentRouter.post(
    "/settle-bets",
    authMiddleware,
    validateParams(settleBetsSchema),
    async (c) => {
        const user = c.get("user")!;
        if (!Config.debug.developerSlugs.includes(user.slug)) {
            return c.json({ error: "Developer access required" }, 403);
        }

        await ensureTournamentTable();
        const outcome = c.req.valid("json");
        const result = await db.transaction(async (tx) => {
            const stateResult = await tx.execute<{ state: TournamentState }>(sql`
                SELECT state
                FROM tournament_bracket_state
                WHERE id = 1
                FOR UPDATE
            `);
            const state = stateResult.rows[0]?.state;
            if (!state) {
                return {
                    error: "Tournament betting is unavailable",
                    status: 503 as const,
                };
            }

            const final = state.matches[TournamentFinalMatchId];
            if (final.winner === null || final.scoreA === null || final.scoreB === null) {
                return {
                    error: "Enter the final score and winner before settling bets",
                    status: 409 as const,
                };
            }
            const winnerScore = final.winner === 0 ? final.scoreA : final.scoreB;
            const loserScore = final.winner === 0 ? final.scoreB : final.scoreA;
            if (winnerScore !== 7 || loserScore < 0 || loserScore > 6) {
                return {
                    error: "The final score must be first to 7",
                    status: 400 as const,
                };
            }

            const inserted = await tx.execute(sql`
                INSERT INTO tournament_bet_settlements
                    (tournament_id, match_id, grenade_kills, heal_off, settled_by)
                VALUES
                    (1, ${TournamentFinalMatchId}, ${outcome.grenadeKills},
                     ${outcome.healOff}, ${user.id})
                ON CONFLICT (tournament_id, match_id) DO NOTHING
                RETURNING match_id
            `);
            if (!inserted.rows.length) {
                return { error: "These bets are already settled", status: 409 as const };
            }

            const marginSelection =
                loserScore <= 2 ? "blowout" : loserScore <= 4 ? "comfortable" : "close";
            const winners: Record<TournamentBetMarketId, string> = {
                winner: final.winner === 0 ? "player_a" : "player_b",
                margin: marginSelection,
                game_11: loserScore >= 4 ? "yes" : "no",
                grenade_kills: outcome.grenadeKills >= 3 ? "over" : "under",
                heal_off: outcome.healOff ? "yes" : "no",
            };
            const bets = await tx.execute<
                TournamentBetRow & { id: number; user_id: string }
            >(
                sql`
                    SELECT id, user_id, market, selection, odds_hundredths,
                           amount, status, payout
                    FROM tournament_bets
                    WHERE tournament_id = 1
                        AND match_id = ${TournamentFinalMatchId}
                        AND status = 'pending'
                    FOR UPDATE
                `,
            );
            const payouts = new Map<string, number>();
            for (const bet of bets.rows) {
                const won = winners[bet.market] === bet.selection;
                const payout = won
                    ? Math.floor((Number(bet.amount) * Number(bet.odds_hundredths)) / 100)
                    : 0;
                await tx.execute(sql`
                    UPDATE tournament_bets
                    SET status = ${won ? "won" : "lost"},
                        payout = ${payout},
                        settled_at = now()
                    WHERE id = ${bet.id}
                `);
                if (payout > 0) {
                    payouts.set(bet.user_id, (payouts.get(bet.user_id) ?? 0) + payout);
                }
            }
            for (const [userId, payout] of payouts) {
                await tx.execute(sql`
                    UPDATE users
                    SET gp_balance = gp_balance + ${payout}
                    WHERE id = ${userId}
                `);
            }
            return { success: true as const, settledBets: bets.rows.length };
        });

        if ("error" in result) return c.json({ error: result.error }, result.status);
        return c.json(result);
    },
);

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
            if (update.matchId === TournamentFinalMatchId) {
                const settlement = await tx.execute(sql`
                    SELECT match_id
                    FROM tournament_bet_settlements
                    WHERE tournament_id = 1
                        AND match_id = ${TournamentFinalMatchId}
                `);
                const finalChanged =
                    nextState.matches[update.matchId].scoreA !== update.scoreA ||
                    nextState.matches[update.matchId].scoreB !== update.scoreB ||
                    nextState.matches[update.matchId].winner !== update.winner;
                if (settlement.rows.length && finalChanged) {
                    throw new Error("Cannot change the final after bets were settled");
                }
            }
            const oldWinner = nextState.matches[update.matchId].winner;
            nextState.matches[update.matchId] = {
                scoreA: update.scoreA,
                scoreB: update.scoreB,
                winner: update.winner,
            };
            if (oldWinner !== update.winner) {
                const descendantIds = getTournamentDescendantMatchIds(update.matchId);
                if (descendantIds.includes(TournamentFinalMatchId)) {
                    const settlement = await tx.execute(sql`
                        SELECT match_id
                        FROM tournament_bet_settlements
                        WHERE tournament_id = 1
                            AND match_id = ${TournamentFinalMatchId}
                    `);
                    if (settlement.rows.length) {
                        throw new Error(
                            "Cannot change the bracket after final bets were settled",
                        );
                    }
                    const refunds = await tx.execute<{
                        user_id: string;
                        amount: number | string;
                    }>(sql`
                        SELECT user_id, SUM(amount) AS amount
                        FROM tournament_bets
                        WHERE tournament_id = 1
                            AND match_id = ${TournamentFinalMatchId}
                            AND status = 'pending'
                        GROUP BY user_id
                    `);
                    for (const refund of refunds.rows) {
                        await tx.execute(sql`
                            UPDATE users
                            SET gp_balance = gp_balance + ${Number(refund.amount)}
                            WHERE id = ${refund.user_id}
                        `);
                    }
                    await tx.execute(sql`
                        DELETE FROM tournament_bets
                        WHERE tournament_id = 1
                            AND match_id = ${TournamentFinalMatchId}
                            AND status = 'pending'
                    `);
                }
                for (const descendantId of descendantIds) {
                    await tx.execute(sql`
                        DELETE FROM tournament_predictions
                        WHERE tournament_id = 1 AND match_id = ${descendantId}
                    `);
                }
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
