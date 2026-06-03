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
    side_quest_kills_200: {
        type: "quest",
        event: "kill",
        target: 200,
        xp: 0,
        gp: 100,
        title: "Kill 200 players",
    },
    side_quest_survive_10m: {
        type: "quest",
        event: "survived",
        target: 3600,
        xp: 0,
        gp: 75,
        title: "Survive 1 hour",
    },
    side_quest_kills_50: {
        type: "quest",
        event: "kill",
        target: 50,
        xp: 0,
        gp: 100,
        title: "Kill 50 players",
    },
    side_quest_damage_10000: {
        type: "quest",
        event: "damage",
        target: 10000,
        xp: 0,
        gp: 175,
        title: "Deal 10,000 damage",
    },
    side_quest_win_5_games: {
        type: "quest",
        event: "placement",
        target: 5,
        xp: 0,
        gp: 300,
        title: "Win 5 games",
        where: {
            maxRank: 1,
        },
    },
    side_quest_survive_2h: {
        type: "quest",
        event: "survived",
        target: 7200,
        xp: 0,
        gp: 250,
        title: "Survive 2 hours",
    },
    side_quest_melee_damage_1000: {
        type: "quest",
        event: "damage",
        target: 1000,
        xp: 0,
        gp: 100,
        title: "Deal 1,000 melee damage",
        where: {
            weaponClass: "melee",
        },
    },
    side_quest_destroy_crates_200: {
        type: "quest",
        event: "destruction",
        target: 200,
        xp: 0,
        gp: 125,
        title: "Destroy 200 crates",
        where: {
            obstacleType: "crate",
        },
    },
} satisfies Record<string, SideQuestDef>;

export const SideQuestSlotIndexes = [100] as const;
export const SideQuestRefreshCooldownMs = 24 * 60 * 60 * 1000;

export function isSideQuestType(
    questType: string,
): questType is keyof typeof SideQuestDefs {
    return questType in SideQuestDefs;
}
