import { Rarity } from "../../gameConfig";

export interface DeathEffectDef {
    readonly type: "death_effect";
    name: string;
    rarity: Rarity;
    texture: string;
    particle: string;
    particleCount?: number;
    sound?: string;
}

export const DeathEffectDefs: Record<string, DeathEffectDef> = {
    death_none: {
        type: "death_effect",
        name: "No Effect",
        rarity: Rarity.Stock,
        texture: "loot-skull-death.img",
        particle: "deathSplash",
        particleCount: 0,
    },
    death_basic: {
        type: "death_effect",
        name: "Standard Death",
        rarity: Rarity.Stock,
        texture: "loot-basic-puff-death.img",
        particle: "deathSplash",
        particleCount: 10,
    },
    death_blood_explosion: {
        type: "death_effect",
        name: "Blood Explosion",
        rarity: Rarity.Epic,
        texture: "loot-blood-explosion.img",
        particle: "bloodExplosion",
        particleCount: 15,
    },
    death_confetti: {
        type: "death_effect",
        name: "Confetti",
        rarity: Rarity.Rare,
        texture: "loot-confetti-death.img",
        particle: "confettiDeath",
        particleCount: 40,
    },
    death_sparkle: {
        type: "death_effect",
        name: "Mr Sparkles",
        rarity: Rarity.Epic,
        texture: "loot-sparkly-death.img",
        particle: "sparklyDeath",
        particleCount: 35,
    },
    death_potato: {
        type: "death_effect",
        name: "Potato Blast",
        rarity: Rarity.Rare,
        texture: "loot-potato-blast-death.img",
        particle: "potatoDeath",
        particleCount: 25,
    },
    death_toon_blast: {
        type: "death_effect",
        name: "Toon Blast",
        rarity: Rarity.Common,
        texture: "loot-explosive-death.img",
        particle: "toonBlastDeath",
        particleCount: 12,
    },
};
