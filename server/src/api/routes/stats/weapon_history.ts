import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { GameObjectDefs } from "../../../../../shared/defs/gameObjectDefs";
import {
    type WeaponHistoryResponse,
    zWeaponHistoryRequest,
} from "../../../../../shared/types/stats";
import type { Context } from "../..";
import {
    databaseEnabledMiddleware,
    rateLimitMiddleware,
    validateParams,
} from "../../auth/middleware";
import { db } from "../../db";
import { matchDataTable, usersTable } from "../../db/schema";

export const weaponHistoryRouter = new Hono<Context>();

weaponHistoryRouter.post(
    "/",
    databaseEnabledMiddleware,
    rateLimitMiddleware(40, 60 * 1000),
    validateParams(zWeaponHistoryRequest),
    async (c) => {
        const { slug } = c.req.valid("json");
        const matches = await db
            .select({
                createdAt: matchDataTable.createdAt,
                weaponKills: matchDataTable.weaponKills,
            })
            .from(matchDataTable)
            .innerJoin(usersTable, eq(usersTable.id, matchDataTable.userId))
            .where(eq(usersTable.slug, slug))
            .orderBy(desc(matchDataTable.createdAt));

        const weapons = new Map<string, WeaponHistoryResponse[number]>();
        for (const match of matches) {
            for (const [type, kills] of Object.entries(match.weaponKills)) {
                if (!kills || GameObjectDefs[type]?.type !== "gun") continue;

                const existing = weapons.get(type);
                if (existing) {
                    existing.kills += kills;
                } else {
                    weapons.set(type, {
                        type,
                        kills,
                        last_used: match.createdAt,
                    });
                }
            }
        }

        return c.json<WeaponHistoryResponse>(
            [...weapons.values()].sort((a, b) => b.kills - a.kills),
        );
    },
);
