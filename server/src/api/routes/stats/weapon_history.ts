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
                weaponDeaths: matchDataTable.weaponDeaths,
                weaponDamageDealt: matchDataTable.weaponDamageDealt,
                weaponDamageTaken: matchDataTable.weaponDamageTaken,
            })
            .from(matchDataTable)
            .innerJoin(usersTable, eq(usersTable.id, matchDataTable.userId))
            .where(eq(usersTable.slug, slug))
            .orderBy(desc(matchDataTable.createdAt));

        const weapons = new Map<string, WeaponHistoryResponse[number]>();
        for (const match of matches) {
            const addStats = (
                stats: Record<string, number>,
                field: "kills" | "deaths" | "damage_dealt" | "damage_taken",
            ) => {
                for (const [weaponType, amount] of Object.entries(stats)) {
                    const defType = GameObjectDefs[weaponType]?.type;
                    if (!amount || (defType !== "gun" && defType !== "melee")) continue;

                    const type = defType === "melee" ? "fists" : weaponType;
                    const existing = weapons.get(type) ?? {
                        type,
                        kills: 0,
                        deaths: 0,
                        damage_dealt: 0,
                        damage_taken: 0,
                        last_used: match.createdAt,
                    };
                    existing[field] += amount;
                    weapons.set(type, existing);
                }
            };

            addStats(match.weaponKills, "kills");
            addStats(match.weaponDeaths, "deaths");
            addStats(match.weaponDamageDealt, "damage_dealt");
            addStats(match.weaponDamageTaken, "damage_taken");
        }

        return c.json<WeaponHistoryResponse>(
            [...weapons.values()]
                .map((weapon) => ({
                    ...weapon,
                    damage_dealt: Math.round(weapon.damage_dealt),
                    damage_taken: Math.round(weapon.damage_taken),
                }))
                .sort((a, b) => b.kills - a.kills),
        );
    },
);
