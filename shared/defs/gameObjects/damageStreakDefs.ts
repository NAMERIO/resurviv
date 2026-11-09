export interface DamageStreakDef {
    readonly type: "streak";
    readonly name: string;
    readonly lore: string;
    readonly rewardType: "perk" | "gun" | "dash" | "role";
    readonly rewardItem: string;
    readonly duration: number;
    readonly dashDistance?: number;
    readonly damageRequirement?: number;
    readonly cooldown?: number;
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
        lore: "Increased fire rate for 10 seconds!",
        rewardType: "perk",
        rewardItem: "streak_rapid_fire_effect",
        duration: 10,
        lootImg: {
            sprite: "loot-perk-rapid-bullet.img",
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
        lore: "Obtain an AWM-S for 10 seconds!",
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
        lore: "Damage reduction + health regen for 10 seconds!",
        rewardType: "perk",
        rewardItem: "streak_juggernaut_effect",
        duration: 10,
        lootImg: {
            sprite: "loot-perk-aoe-heal.img",
            tint: 0xffffff,
            border: "loot-circle-outer-03.img",
            borderTint: 0xff0000,
            scale: 0.275,
        },
        sound: { activate: "perk_pickup_01" },
    },
    streak_dash: {
        type: "streak",
        name: "Dash",
        lore: "Dash in your movement direction, or forward while standing still!",
        rewardType: "dash",
        rewardItem: "",
        duration: 0.3,
        dashDistance: 14,
        lootImg: {
            sprite: "loot-perk-dash.img",
            tint: 0xffffff,
            border: "loot-circle-outer-03.img",
            borderTint: 0x55ccff,
            scale: 0.275,
        },
        sound: { activate: "perk_pickup_01" },
    },
    streak_specter: {
        type: "streak",
        name: "Specter",
        lore: "+15% speed and phase through objects for 10 seconds, but not walls. Phasing cancels healing and reloading.",
        rewardType: "perk",
        rewardItem: "streak_specter_effect",
        duration: 10,
        damageRequirement: 400,
        lootImg: {
            sprite: "loot-perk-specter.img",
            tint: 0xffffff,
            border: "loot-circle-outer-03.img",
            borderTint: 0x55ccff,
            scale: 0.275,
        },
        sound: { activate: "perk_pickup_01" },
    },
    streak_vanish: {
        type: "streak",
        name: "Vanish",
        lore: "Pop smoke and go invisible with +20% speed for 1.5 seconds, or until you shoot.",
        rewardType: "perk",
        rewardItem: "streak_vanish_effect",
        duration: 1.5,
        damageRequirement: 200,
        cooldown: 5,
        lootImg: {
            sprite: "loot-perk-vanish.img",
            tint: 0xffffff,
            border: "loot-circle-outer-03.img",
            borderTint: 0x8899aa,
            scale: 0.275,
        },
        sound: { activate: "perk_pickup_01" },
    },
    streak_samurai: {
        type: "streak",
        name: "Samurai",
        lore: "Gain windwalk, melee runner, juggernaut, but become confined to a katana. Immune to snow.",
        rewardType: "role",
        rewardItem: "samurai",
        duration: 10,
        lootImg: {
            sprite: "loot-perk-samurai.img",
            tint: 0xffffff,
            border: "loot-circle-outer-03.img",
            borderTint: 0x55ccff,
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
    streak_specter_effect: {
        speedMult: 1.15,
    },
    streak_vanish_effect: {
        speedMult: 1.2,
    },
};
