import { Rarity } from "../../gameConfig";

export interface DamageStreakDef {
    readonly type: "streak";
    readonly name: string;
    readonly rarity: Rarity;
    readonly lore: string;
    readonly rewardType: "perk" | "gun";
    readonly rewardItem: string;
    readonly duration: number;
    readonly lootImg: {
        sprite: string;
        tint: number;
        border: string;
        borderTint: number;
        scale: number;
    };
    readonly sound: {
        activate: string;
    };
}

export const StreakThresholds = {
    firstActivation: 300,
    increment: 400,
    get(activationIndex: number): number {
        return (
            StreakThresholds.firstActivation +
            activationIndex * StreakThresholds.increment
        );
    },
};

export const DamageStreakDefs: Record<string, DamageStreakDef> = {
    streak_rapid_fire: {
        type: "streak",
        name: "Rapid Fire",
        rarity: Rarity.Common,
        lore: "Increased fire rate for 10 seconds!",
        rewardType: "perk",
        rewardItem: "streak_rapid_fire_effect",
        duration: 10,
        lootImg: {
            sprite: "loot-perk-firepower.img",
            tint: 0xffffff,
            border: "loot-circle-outer-03.img",
            borderTint: 0xff4400,
            scale: 0.275,
        },
        sound: { activate: "perk_pickup_01" },
    },
    streak_heavy_hitter: {
        type: "streak",
        name: "Heavy Hitter",
        rarity: Rarity.Rare,
        lore: "AWM-S sniper for 10 seconds!",
        rewardType: "gun",
        rewardItem: "awc",
        duration: 10,
        lootImg: {
            sprite: "loot-weapon-awc.img",
            tint: 0xffffff,
            border: "loot-circle-outer-03.img",
            borderTint: 0xffaa00,
            scale: 0.275,
        },
        sound: { activate: "perk_pickup_01" },
    },
    streak_juggernaut: {
        type: "streak",
        name: "Juggernaut",
        rarity: Rarity.Uncommon,
        lore: "Damage reduction + health regen for 10 seconds!",
        rewardType: "perk",
        rewardItem: "streak_juggernaut_effect",
        duration: 10,
        lootImg: {
            sprite: "loot-perk-steelskin.img",
            tint: 0xffffff,
            border: "loot-circle-outer-03.img",
            borderTint: 0xff0000,
            scale: 0.275,
        },
        sound: { activate: "perk_pickup_01" },
    },
};

export const DefaultStreakType = "streak_rapid_fire";

export const DamageStreakProperties = {
    streak_rapid_fire_effect: {
        fireDelayMult: 0.5,
    },
    streak_juggernaut_effect: {
        damageReduction: 0.5,
        healthRegen: 3,
    },
};
