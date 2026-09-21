import { z } from "zod";

export const WHR_SETTINGS = {
    prior: 2,
    w: 0.0215,
    mean: 5000,
    scale: 1000,
    placementGames: 3,
} as const;

const slug = z.string().trim().min(1).max(100);
export const zCompetitiveResult = z
    .object({
        teams: z.array(z.array(slug).min(1).max(4)).min(2).max(32),
        scores: z.array(z.number().int().min(0).max(1000)).optional(),
    })
    .superRefine((result, ctx) => {
        const players = result.teams.flat();
        if (new Set(players).size !== players.length) {
            ctx.addIssue({ code: "custom", message: "A player cannot appear twice." });
        }
        if (result.teams.some((team) => team.length !== result.teams[0].length)) {
            ctx.addIssue({ code: "custom", message: "Teams must have equal sizes." });
        }
        if (
            result.scores &&
            (result.scores.length !== result.teams.length ||
                !result.scores.some((score) => score > 0))
        ) {
            ctx.addIssue({
                code: "custom",
                message: "Provide one score per team, with at least one positive score.",
            });
        }
    });

export function parseCompetitiveResult(players: string, scores?: string) {
    return zCompetitiveResult.parse({
        teams: players
            .split(",")
            .map((team) => team.split("+").map((name) => name.trim())),
        scores:
            scores === undefined
                ? undefined
                : scores
                      .split(",")
                      .map((score) => (score.trim() === "" ? NaN : Number(score))),
    });
}

export const zAddCompetitiveMatch = z
    .object({
        ...zCompetitiveResult.shape,
        reference: z
            .string()
            .trim()
            .toLowerCase()
            .min(1)
            .max(100)
            .regex(/^[a-z0-9][a-z0-9._:/-]*$/),
        requestId: z.string().regex(/^\d{10,25}$/),
        executorId: z.string().regex(/^\d{10,25}$/),
        playedOn: z.iso.date(),
        note: z.string().trim().max(300).default(""),
    })
    .superRefine((data, ctx) => {
        const result = zCompetitiveResult.safeParse(data);
        if (!result.success)
            for (const issue of result.error.issues)
                ctx.addIssue({ code: "custom", message: issue.message });
        if (data.playedOn > new Date().toISOString().slice(0, 10))
            ctx.addIssue({
                code: "custom",
                message: "Match date cannot be in the future.",
            });
    });

export const zVoidCompetitiveMatch = z.object({
    matchId: z.uuid(),
    executorId: z.string().regex(/^\d{10,25}$/),
    reason: z.string().trim().min(3).max(300),
});

export interface CompetitiveRating {
    userId: string;
    rating: number;
    games: number;
}

export interface CompetitiveGame {
    teams: string[][];
    scores?: number[];
    playedOn: string;
}

export interface CompetitiveBoard {
    season: { id: number; name: string };
    updatedAt: string | null;
    placementGames: number;
    players: {
        slug: string;
        username: string;
        playerIcon: string;
        rating: number;
        games: number;
        rank: number | null;
        stats: CompetitivePlayerStats;
    }[];
    matches: {
        id: string;
        reference: string;
        playedOn: string;
        teams: string[][];
        scores: number[] | null;
        note: string;
        voidReason: string | null;
    }[];
    matchOffset: number;
    hasMoreMatches: boolean;
}

export interface CompetitivePlayerStats {
    wins: number;
    draws: number;
    losses: number;
    averagePlacement: number;
}
