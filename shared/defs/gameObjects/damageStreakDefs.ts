export interface DamageStreakReward {
    readonly type: string;
    readonly name: string;
    readonly description: string;
    readonly damageThreshold: number;
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

export const DamageStreakDefs: DamageStreakReward[] = [
    {
        type: "streak_rapid_fire",
        name: "Rapid Fire",
        description: "Increased fire rate for 10 seconds!",
        damageThreshold: 150,
        rewardType: "perk",
        rewardItem: "streak_rapid_fire",
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
    {
        type: "streak_heavy_hitter",
        name: "Heavy Hitter",
        description: "AWM-S sniper for 10 seconds!",
        damageThreshold: 300,
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
    {
        type: "streak_juggernaut",
        name: "Juggernaut",
        description: "Damage reduction + health regen for 10 seconds!",
        damageThreshold: 500,
        rewardType: "perk",
        rewardItem: "streak_juggernaut",
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
];

export const DamageStreakProperties = {
    streak_rapid_fire: {
        fireDelayMult: 0.5,
    },
    streak_juggernaut: {
        damageReduction: 0.5,
        healthRegen: 3,
    },
};
