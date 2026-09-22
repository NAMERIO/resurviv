import { Hono } from "hono";
import { z } from "zod";
import {
    zCompetitiveWebMatch,
    zCompetitiveWebVoid,
} from "../../../../../shared/types/competitive";
import { Config } from "../../../config";
import { authMiddleware, databaseEnabledMiddleware } from "../../auth/middleware";
import {
    addCompetitiveMatch,
    getCompetitiveBoard,
    getCompetitiveSeasons,
    searchCompetitivePlayers,
    voidCompetitiveMatch,
} from "../../competitive/service";
import type { Context } from "../../index";

export const competitiveRouter = new Hono<Context>()
    .use(databaseEnabledMiddleware)
    .get("/permissions", authMiddleware, (c) => {
        const user = c.get("user")!;
        return c.json({
            canEdit: !user.banned && Config.debug.developerSlugs.includes(user.slug),
        });
    })
    .use("/editor/*", authMiddleware, async (c, next) => {
        const user = c.get("user")!;
        if (user.banned || !Config.debug.developerSlugs.includes(user.slug))
            return c.json({ error: "Developer access required." }, 403);
        if (!c.req.header("content-type")?.startsWith("application/json"))
            return c.json({ error: "A JSON request is required." }, 415);
        await next();
    })
    .post("/editor/players", async (c) => {
        const parsed = z
            .object({ query: z.string().trim().min(2).max(100) })
            .safeParse(await c.req.json().catch(() => null));
        if (!parsed.success)
            return c.json(
                { error: "Type at least two characters of a name or slug." },
                400,
            );
        return c.json({ players: await searchCompetitivePlayers(parsed.data.query) });
    })
    .post("/editor/result", async (c) => {
        const parsed = zCompetitiveWebMatch.safeParse(
            await c.req.json().catch(() => null),
        );
        if (!parsed.success)
            return c.json({ error: parsed.error.issues[0].message }, 400);
        const input = parsed.data;
        const actor = `web:${c.get("user")!.id}`;
        return c.json(
            await addCompetitiveMatch(
                {
                    teams: input.teams,
                    scores: input.scores,
                    winnerTeam: input.winnerTeam,
                    playedOn: input.playedOn,
                    reference: `web-${input.requestId}`,
                    requestId: `${actor}:${input.requestId}`,
                    executorId: actor,
                    note: "",
                },
                { seasonId: input.seasonId, replacesMatchId: input.matchId },
            ),
        );
    })
    .post("/editor/void", async (c) => {
        const parsed = zCompetitiveWebVoid.safeParse(
            await c.req.json().catch(() => null),
        );
        if (!parsed.success)
            return c.json({ error: parsed.error.issues[0].message }, 400);
        await voidCompetitiveMatch({
            ...parsed.data,
            executorId: `web:${c.get("user")!.id}`,
        });
        return c.json({ message: "Result voided and ratings updated." });
    })
    .get("/seasons", async (c) => c.json(await getCompetitiveSeasons()))
    .get("/", async (c) => {
        const query = z
            .object({
                // Negative IDs allow local demo seasons without advancing the active season.
                season: z.coerce
                    .number()
                    .int()
                    .refine((id) => id !== 0)
                    .optional(),
                offset: z.coerce.number().int().min(0).max(100000).default(0),
            })
            .safeParse(c.req.query());
        if (!query.success)
            return c.json({ error: "Invalid season or match offset." }, 400);
        return c.json(await getCompetitiveBoard(query.data.season, query.data.offset));
    });
