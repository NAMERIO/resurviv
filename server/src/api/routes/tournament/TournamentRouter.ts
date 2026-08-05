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
        const state = await readState();
        const players = getTournamentPlayers(state, update.matchId);
        if (update.winner !== null && !players[update.winner]) {
            return c.json({ error: "That bracket slot has no player yet" }, 400);
        }

        const oldWinner = state.matches[update.matchId].winner;
        state.matches[update.matchId] = {
            scoreA: update.scoreA,
            scoreB: update.scoreB,
            winner: update.winner,
        };
        if (oldWinner !== update.winner) {
            clearTournamentDescendants(state, update.matchId);
        }
        state.updatedAt = Date.now();

        await db.execute(sql`
            UPDATE tournament_bracket_state
            SET state = ${JSON.stringify(state)}::jsonb, updated_at = now()
            WHERE id = 1
        `);
        return c.json(state);
    },
);
