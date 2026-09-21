import { Hono } from "hono";
import { z } from "zod";
import { databaseEnabledMiddleware } from "../../auth/middleware";
import { getCompetitiveBoard, getCompetitiveSeasons } from "../../competitive/service";

export const competitiveRouter = new Hono()
    .use(databaseEnabledMiddleware)
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
