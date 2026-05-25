import { and, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { GameObjectDefs } from "../../../../../shared/defs/gameObjectDefs";
import {
    CurrentPassType,
    PassDefs,
} from "../../../../../shared/defs/gameObjects/passDefs";
import { QuestDefs } from "../../../../../shared/defs/gameObjects/questDefs";
import {
    isSideQuestType,
    SideQuestDefs,
    SideQuestRefreshCooldownMs,
    SideQuestSlotIndexes,
} from "../../../../../shared/defs/gameObjects/sideQuestDefs";
import {
    type BuyFullPassResponse,
    type BuyPremiumPassResponse,
    type GetPassResponse,
    type RefreshQuestResponse,
    type SetPassUnlockResponse,
    zBuyFullPassRequest,
    zBuyPremiumPassRequest,
    zGetPassRequest,
    zRefreshQuestRequest,
    zSetPassUnlockRequest,
    zSetQuestRequest,
} from "../../../../../shared/types/user";
import { passUtil } from "../../../../../shared/utils/passUtil";
import { validateParams } from "../../auth/middleware";
import { db } from "../../db";
import {
    itemsTable,
    type UserPassTableSelect,
    type UserQuestTableSelect,
    userPassTable,
    userQuestTable,
    usersTable,
} from "../../db/schema";
import type { Context } from "../../index";

// hardcoded for now
export const passType = CurrentPassType;
export const questSlotIndexes = [0, 1];
export const premiumPassUnlockType = "premiumPass";

function getTotalXpForLevel(passType: string, level: number) {
    let totalXp = 0;
    for (let currentLevel = 1; currentLevel < level; currentLevel++) {
        totalXp += passUtil.getPassLevelXp(passType, currentLevel);
    }
    return totalXp;
}

/**
 * lazily create pass and quest if they don't exist
 */
async function getPassAndQuests(
    userId: string,
    now: number,
): Promise<{ pass: UserPassTableSelect; quests: UserQuestTableSelect[] }> {
    const rows = await db
        .select({ pass: userPassTable, quest: userQuestTable })
        .from(userPassTable)
        .leftJoin(
            userQuestTable,
            and(
                eq(userQuestTable.userId, userPassTable.userId),
                inArray(userQuestTable.idx, questSlotIndexes),
            ),
        )
        .where(
            and(eq(userPassTable.userId, userId), eq(userPassTable.passType, passType)),
        );

    const existingPass = rows[0]?.pass ?? null;
    const existingQuests = rows
        .map((row) => row.quest)
        .filter((quest): quest is UserQuestTableSelect => quest !== null)
        .sort((a, b) => a.idx - b.idx);

    const hasAllSlots =
        existingQuests.length === questSlotIndexes.length &&
        questSlotIndexes.every((slot, index) => existingQuests[index]?.idx === slot);

    if (existingPass && hasAllSlots) {
        return {
            pass: existingPass,
            quests: existingQuests,
        };
    }

    // create them
    return db.transaction(async (tx) => {
        await tx
            .insert(userPassTable)
            .values({ userId, passType })
            .onConflictDoNothing({
                target: [userPassTable.userId, userPassTable.passType],
            });

        await tx
            .delete(userQuestTable)
            .where(
                and(
                    eq(userQuestTable.userId, userId),
                    inArray(userQuestTable.idx, questSlotIndexes),
                ),
            );

        const blockedTypes = new Set<string>();
        const inserts = questSlotIndexes.map((slot) => {
            const questType = getRandomQuestType(blockedTypes);
            blockedTypes.add(questType);

            return {
                userId,
                idx: slot,
                questType,
                progress: 0,
                target: QuestDefs[questType]!.target,
                complete: false,
                rerolled: false,
                timeAcquired: now,
                nextRefreshAt: passUtil.getNextQuestRefreshAt(now),
            };
        });

        await tx.insert(userQuestTable).values(inserts);

        const pass = await tx.query.userPassTable.findFirst({
            where: and(
                eq(userPassTable.userId, userId),
                eq(userPassTable.passType, passType),
            ),
        });

        const quests = await tx.query.userQuestTable.findMany({
            where: and(
                eq(userQuestTable.userId, userId),
                inArray(userQuestTable.idx, questSlotIndexes),
            ),
            orderBy: userQuestTable.idx,
        });

        if (!pass || !quests.length) {
            throw new Error("failed_to_create_user_pass_and_quests");
        }

        return {
            pass,
            quests,
        };
    });
}

async function rerollSlot(
    userId: string,
    idx: number,
    now: number,
    rerolled: boolean,
    loadedQuests: UserQuestTableSelect[],
) {
    const excludedTypes = new Set(loadedQuests.map((quest) => quest.questType));
    const questType = getRandomQuestType(excludedTypes);

    await db
        .update(userQuestTable)
        .set({
            questType,
            progress: 0,
            target: QuestDefs[questType]!.target,
            complete: false,
            rerolled,
            timeAcquired: now,
            nextRefreshAt: passUtil.getNextQuestRefreshAt(now),
        })
        .where(and(eq(userQuestTable.userId, userId), eq(userQuestTable.idx, idx)));

    return questType;
}

function getRandomSideQuestType(excluded?: string) {
    const questTypes = Object.keys(SideQuestDefs);
    const available = questTypes.filter((questType) => questType !== excluded);
    const source = available.length > 0 ? available : questTypes;
    return source[Math.floor(Math.random() * source.length)] as keyof typeof SideQuestDefs;
}

async function rerollSideQuest(userId: string, idx: number, now: number) {
    const quest = await db.query.userQuestTable.findFirst({
        where: and(eq(userQuestTable.userId, userId), eq(userQuestTable.idx, idx)),
    });
    if (!quest || quest.complete || quest.nextRefreshAt > now) {
        return false;
    }

    const questType = getRandomSideQuestType(quest.questType);
    const questDef = SideQuestDefs[questType];
    await db
        .update(userQuestTable)
        .set({
            questType,
            progress: 0,
            target: questDef.target,
            complete: false,
            rerolled: true,
            timeAcquired: now,
            nextRefreshAt: now + SideQuestRefreshCooldownMs,
        })
        .where(and(eq(userQuestTable.userId, userId), eq(userQuestTable.idx, idx)));

    return true;
}

async function getSideQuests(userId: string, now: number) {
    let sideQuestRows = await db.query.userQuestTable.findMany({
        where: and(
            eq(userQuestTable.userId, userId),
            inArray(userQuestTable.idx, [...SideQuestSlotIndexes]),
        ),
        orderBy: userQuestTable.idx,
    });

    const existingSlots = new Set(sideQuestRows.map((quest) => quest.idx));
    const missingSlots = SideQuestSlotIndexes.filter((slot) => !existingSlots.has(slot));

    if (missingSlots.length > 0) {
        await db
            .insert(userQuestTable)
            .values(
                missingSlots.map((slot) => {
                    const questType = getRandomSideQuestType();
                    const questDef = SideQuestDefs[questType];
                    return {
                        userId,
                        idx: slot,
                        questType,
                        progress: 0,
                        target: questDef.target,
                        complete: false,
                        rerolled: false,
                        timeAcquired: now,
                        nextRefreshAt: 0,
                    };
                }),
            )
            .onConflictDoNothing({
                target: [userQuestTable.userId, userQuestTable.idx],
            });

        return db.query.userQuestTable.findMany({
            where: and(
                eq(userQuestTable.userId, userId),
                inArray(userQuestTable.idx, [...SideQuestSlotIndexes]),
            ),
            orderBy: userQuestTable.idx,
        });
    }

    const expiredCompletedQuests = sideQuestRows.filter(
        (quest) => quest.complete && quest.nextRefreshAt <= now,
    );
    for (const quest of expiredCompletedQuests) {
        const questType = getRandomSideQuestType(quest.questType);
        const questDef = SideQuestDefs[questType];
        await db
            .update(userQuestTable)
            .set({
                questType,
                progress: 0,
                target: questDef.target,
                complete: false,
                rerolled: false,
                timeAcquired: now,
                nextRefreshAt: 0,
            })
            .where(eq(userQuestTable.id, quest.id));
    }
    if (expiredCompletedQuests.length > 0) {
        sideQuestRows = await db.query.userQuestTable.findMany({
            where: and(
                eq(userQuestTable.userId, userId),
                inArray(userQuestTable.idx, [...SideQuestSlotIndexes]),
            ),
            orderBy: userQuestTable.idx,
        });
    }

    return sideQuestRows;
}

export const PassRouter = new Hono<Context>();

PassRouter.post("/get_pass", validateParams(zGetPassRequest), async (c) => {
    const user = c.get("user")!;
    const { tryRefreshQuests } = c.req.valid("json");
    const now = Date.now();

    const { pass, quests } = await getPassAndQuests(user.id, now);
    const sideQuests = await getSideQuests(user.id, now);

    let activeQuests = quests;

    const removedQuests = activeQuests.filter((quest) =>
        isRemovedQuestType(quest.questType),
    );
    for (const quest of removedQuests) {
        const newType = await rerollSlot(user.id, quest.idx, now, false, activeQuests);
        activeQuests = activeQuests.map((current) =>
            current.idx === quest.idx
                ? {
                      ...current,
                      questType: newType,
                      progress: 0,
                      target: QuestDefs[newType]!.target,
                      complete: false,
                      rerolled: false,
                      timeAcquired: now,
                      nextRefreshAt: passUtil.getNextQuestRefreshAt(now),
                  }
                : current,
        );
    }

    if (tryRefreshQuests) {
        const expiredQuests = activeQuests.filter(
            (quest) => quest.nextRefreshAt - now < 0,
        );
        for (const quest of expiredQuests) {
            const newType = await rerollSlot(
                user.id,
                quest.idx,
                now,
                false,
                activeQuests,
            );
            activeQuests = activeQuests.map((current) =>
                current.idx === quest.idx
                    ? {
                          ...current,
                          questType: newType,
                          progress: 0,
                          target: QuestDefs[newType]!.target,
                          complete: false,
                          rerolled: false,
                          timeAcquired: now,
                          nextRefreshAt: passUtil.getNextQuestRefreshAt(now),
                      }
                    : current,
            );
        }
    }

    if (pass.newItems) {
        await db
            .update(userPassTable)
            .set({
                newItems: false,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(userPassTable.userId, user.id),
                    eq(userPassTable.passType, pass.passType),
                ),
            );
    }

    const { level, xp } = passUtil.getPassLevelAndXp(pass.passType, pass.totalXp);
    return c.json<GetPassResponse>(
        {
            success: true,
            pass: {
                type: pass.passType,
                level,
                xp,
                unlocks: pass.unlocks || {},
                newItems: pass.newItems,
            },
            quests: activeQuests.map((quest) => ({
                idx: quest.idx,
                type: quest.questType,
                progress: quest.progress,
                target: quest.target,
                complete: quest.complete,
                rerolled: quest.rerolled,
                timeToRefresh: quest.nextRefreshAt - now,
            })),
            sideQuests: sideQuests.map((quest) => {
                const questDef = isSideQuestType(quest.questType)
                    ? SideQuestDefs[quest.questType]
                    : undefined;
                return {
                    idx: quest.idx,
                    type: quest.questType,
                    progress: quest.progress,
                    target: quest.target,
                    complete: quest.complete,
                    rerolled: quest.rerolled,
                    timeToRefresh: Math.max(0, quest.nextRefreshAt - now),
                    gpReward: questDef?.gp ?? 0,
                    title: questDef?.title ?? quest.questType,
                };
            }),
        },
        200,
    );
});

PassRouter.post("/refresh_quest", validateParams(zRefreshQuestRequest), async (c) => {
    const user = c.get("user")!;
    const { idx } = c.req.valid("json");
    const now = Date.now();

    if (SideQuestSlotIndexes.includes(idx as (typeof SideQuestSlotIndexes)[number])) {
        const success = await rerollSideQuest(user.id, idx, now);
        return c.json<RefreshQuestResponse>({ success }, 200);
    }

    const quests = await db.query.userQuestTable.findMany({
        where: and(
            eq(userQuestTable.userId, user.id),
            inArray(userQuestTable.idx, questSlotIndexes),
        ),
    });

    const quest = quests.find((entry) => entry.idx === idx);

    if (!quest) {
        return c.json<RefreshQuestResponse>({ success: false }, 200);
    }

    const expired = quest.nextRefreshAt - now < 0;
    const refreshEnabled = (!quest.rerolled && !quest.complete) || expired;
    if (!refreshEnabled) {
        return c.json<RefreshQuestResponse>({ success: false }, 200);
    }

    await rerollSlot(user.id, idx, now, !expired, quests);
    return c.json<RefreshQuestResponse>({ success: true }, 200);
});

PassRouter.post(
    "/set_quest",
    validateParams(zSetQuestRequest),
    // biome-ignore lint/suspicious/useAwait: to please the client
    async (c) => {
        return c.json({ success: true }, 200);
    },
);

PassRouter.post("/set_pass_unlock", validateParams(zSetPassUnlockRequest), (c) => {
    // surviv has not social media
    // trivial to add tho

    return c.json<SetPassUnlockResponse>({ success: true }, 200);
});

PassRouter.post(
    "/buy_premium_pass",
    validateParams(zBuyPremiumPassRequest),
    async (c) => {
        const user = c.get("user")!;
        const passDef = PassDefs[passType];
        const price = passDef.premiumPrice ?? 1500;
        const now = Date.now();

        try {
            const { pass } = await getPassAndQuests(user.id, now);
            const result = await db.transaction(async (tx) => {
                const { level } = passUtil.getPassLevelAndXp(pass.passType, pass.totalXp);
                if (pass.unlocks?.[premiumPassUnlockType]) {
                    return {
                        ok: false as const,
                        error: "already_purchased" as const,
                        gpBalance: user.gpBalance,
                    };
                }

                const buyer = await tx.query.usersTable.findFirst({
                    where: eq(usersTable.id, user.id),
                    columns: {
                        gpBalance: true,
                    },
                });

                if (!buyer || buyer.gpBalance < price) {
                    return {
                        ok: false as const,
                        error: "not_enough_gp" as const,
                        gpBalance: buyer?.gpBalance ?? user.gpBalance,
                    };
                }

                const rewards = (passDef.premiumItems ?? []).filter(
                    (reward) => reward.level <= level,
                );
                const rewardItems = rewards
                    .flatMap((reward) => ("item" in reward ? [reward.item] : []))
                    .filter((item) => !!GameObjectDefs[item]);
                const rewardGp = rewards.reduce(
                    (total, reward) => total + ("gp" in reward ? (reward.gp ?? 0) : 0),
                    0,
                );
                const insertedRewards =
                    rewardItems.length > 0
                        ? await tx
                              .insert(itemsTable)
                              .values(
                                  rewardItems.map((item) => ({
                                      userId: user.id,
                                      type: item,
                                      source: `${pass.passType}_premium`,
                                      timeAcquired: now,
                                  })),
                              )
                              .returning({
                                  type: itemsTable.type,
                              })
                        : [];

                await tx
                    .update(userPassTable)
                    .set({
                        unlocks: {
                            ...(pass.unlocks ?? {}),
                            [premiumPassUnlockType]: true,
                        },
                        newItems:
                            insertedRewards.length > 0
                                ? true
                                : sql`${userPassTable.newItems}`,
                        updatedAt: new Date(),
                    })
                    .where(
                        and(
                            eq(userPassTable.userId, user.id),
                            eq(userPassTable.passType, pass.passType),
                        ),
                    );

                await tx
                    .update(usersTable)
                    .set({
                        gpBalance: buyer.gpBalance - price + rewardGp,
                    })
                    .where(eq(usersTable.id, user.id));

                return {
                    ok: true as const,
                    gpBalance: buyer.gpBalance - price + rewardGp,
                };
            });

            if (!result.ok) {
                return c.json<BuyPremiumPassResponse>(
                    {
                        success: false,
                        error: result.error,
                        gpBalance: result.gpBalance,
                    },
                    200,
                );
            }

            return c.json<BuyPremiumPassResponse>(
                {
                    success: true,
                    gpBalance: result.gpBalance,
                },
                200,
            );
        } catch (error) {
            console.error("buy_premium_pass failed", error);
            return c.json<BuyPremiumPassResponse>(
                { success: false, error: "server_error" },
                200,
            );
        }
    },
);

PassRouter.post("/buy_full_pass", validateParams(zBuyFullPassRequest), async (c) => {
    const user = c.get("user")!;
    const passDef = PassDefs[passType];
    const price = passDef.unlockAllPrice ?? 3000;
    const now = Date.now();

    try {
        const { pass } = await getPassAndQuests(user.id, now);
        const result = await db.transaction(async (tx) => {
            const maxLevel = passUtil.getPassMaxLevel();
            const { level } = passUtil.getPassLevelAndXp(pass.passType, pass.totalXp);
            const ownsPremiumPass = !!pass.unlocks?.[premiumPassUnlockType];
            if (ownsPremiumPass && level >= maxLevel) {
                return {
                    ok: false as const,
                    error: "already_purchased" as const,
                    gpBalance: user.gpBalance,
                };
            }

            const buyer = await tx.query.usersTable.findFirst({
                where: eq(usersTable.id, user.id),
                columns: {
                    gpBalance: true,
                },
            });

            if (!buyer || buyer.gpBalance < price) {
                return {
                    ok: false as const,
                    error: "not_enough_gp" as const,
                    gpBalance: buyer?.gpBalance ?? user.gpBalance,
                };
            }

            const maxTotalXp = getTotalXpForLevel(pass.passType, maxLevel);
            const basicRewards = passDef.items.filter(
                (reward) => reward.level > level && reward.level <= maxLevel,
            );
            const premiumRewards = (passDef.premiumItems ?? []).filter((reward) => {
                return (
                    reward.level <= maxLevel && (!ownsPremiumPass || reward.level > level)
                );
            });
            const rewards = basicRewards.concat(premiumRewards);
            const rewardItems = rewards
                .flatMap((reward) => ("item" in reward ? [reward.item] : []))
                .filter((item) => !!GameObjectDefs[item]);
            const rewardGp = rewards.reduce(
                (total, reward) => total + ("gp" in reward ? (reward.gp ?? 0) : 0),
                0,
            );
            const insertedRewards =
                rewardItems.length > 0
                    ? await tx
                          .insert(itemsTable)
                          .values(
                              rewardItems.map((item) => ({
                                  userId: user.id,
                                  type: item,
                                  source: `${pass.passType}_unlock_all`,
                                  timeAcquired: now,
                              })),
                          )
                          .returning({
                              type: itemsTable.type,
                          })
                    : [];

            await tx
                .update(userPassTable)
                .set({
                    totalXp: Math.max(pass.totalXp, maxTotalXp),
                    unlocks: {
                        ...(pass.unlocks ?? {}),
                        [premiumPassUnlockType]: true,
                    },
                    newItems:
                        insertedRewards.length > 0
                            ? true
                            : sql`${userPassTable.newItems}`,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(userPassTable.userId, user.id),
                        eq(userPassTable.passType, pass.passType),
                    ),
                );

            await tx
                .update(usersTable)
                .set({
                    gpBalance: buyer.gpBalance - price + rewardGp,
                })
                .where(eq(usersTable.id, user.id));

            return {
                ok: true as const,
                gpBalance: buyer.gpBalance - price + rewardGp,
            };
        });

        if (!result.ok) {
            return c.json<BuyFullPassResponse>(
                {
                    success: false,
                    error: result.error,
                    gpBalance: result.gpBalance,
                },
                200,
            );
        }

        return c.json<BuyFullPassResponse>(
            {
                success: true,
                gpBalance: result.gpBalance,
            },
            200,
        );
    } catch (error) {
        console.error("buy_full_pass failed", error);
        return c.json<BuyFullPassResponse>(
            { success: false, error: "server_error" },
            200,
        );
    }
});

function isRemovedQuestType(questType: string) {
    return QuestDefs[questType]?.event === "placement";
}

const questTypes = Object.keys(QuestDefs).filter((questType) => {
    return !isRemovedQuestType(questType) && !isSideQuestType(questType);
});
const defaultQuestType = questTypes[0] || "quest_kills";

function getRandomQuestType(excluded: Set<string>) {
    const available = questTypes.filter((questType) => !excluded.has(questType));
    const source = available.length > 0 ? available : questTypes;
    const idx = Math.floor(Math.random() * source.length);
    return source[idx] ?? defaultQuestType;
}
