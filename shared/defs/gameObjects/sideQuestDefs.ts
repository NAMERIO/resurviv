import type { QuestDef } from "./questDefs";

export interface SideQuestDef extends QuestDef {
    gp: number;
    title: string;
}

export const SideQuestDefs = {
    side_quest_win_streak_3: {
        type: "quest",
        event: "placement",
        target: 3,
        xp: 0,
        gp: 200,
        title: "Win 3 games in a row",
        where: {
            maxRank: 1,
        },
    },
    side_quest_kills_20: {
        type: "quest",
        event: "kill",
        target: 20,
        xp: 0,
        gp: 100,
        title: "Kill 20 players",
    },
    side_quest_survive_10m: {
        type: "quest",
        event: "survived",
        target: 600,
        xp: 0,
        gp: 75,
        title: "Survive 10 minutes",
    },
} satisfies Record<string, SideQuestDef>;

export const SideQuestSlotIndexes = [100] as const;
export const SideQuestRefreshCooldownMs = 24 * 60 * 60 * 1000;

export function isSideQuestType(
    questType: string,
): questType is keyof typeof SideQuestDefs {
    return questType in SideQuestDefs;
}
