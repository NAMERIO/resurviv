import { Hono } from "hono";
import { z } from "zod";
import {
    zAddCompetitiveMatch,
    zVoidCompetitiveMatch,
} from "../../../../../shared/types/competitive";
import { databaseEnabledMiddleware, validateParams } from "../../auth/middleware";
import {
    addCompetitiveMatch,
    startCompetitiveSeason,
    validateCompetitivePlayers,
    voidCompetitiveMatch,
} from "../../competitive/service";

// Mounted only beneath the private API-key middleware. Discord permissions are
// checked by the trusted bot before it calls these endpoints.
export const competitivePrivateRouter = new Hono()
    .use(databaseEnabledMiddleware)
    .post(
        "/validate-players",
        validateParams(
            z.object({ slugs: z.array(z.string().trim().min(1).max(100)).min(1).max(4) }),
        ),
        async (c) => {
            await validateCompetitivePlayers(c.req.valid("json").slugs);
            return c.json({ valid: true });
        },
    )
    .post("/add", validateParams(zAddCompetitiveMatch), async (c) =>
        c.json(await addCompetitiveMatch(c.req.valid("json"))),
    )
    .post("/void", validateParams(zVoidCompetitiveMatch), async (c) => {
        await voidCompetitiveMatch(c.req.valid("json"));
        return c.json({ message: "Match voided and ratings recalculated." });
    })
    .post(
        "/season",
        validateParams(z.object({ name: z.string().trim().min(1).max(60) })),
        async (c) => c.json(await startCompetitiveSeason(c.req.valid("json").name)),
    );
