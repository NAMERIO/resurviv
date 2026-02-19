import { Rarity } from "../../gameConfig";

export interface DeathEffectDef {
    readonly type: "death_effect";
    name: string;
    rarity: Rarity;
    texture: string;
    particle: string;
    particleCount?: number;
    sound?: string;
    // For animated sprite effects (like black hole)
    isParticle?: boolean;
    sprites?: string[];
    animationSpeed?: number;
    animationScale?: number;
    // For particle effects with custom min/max particle counts
    minParticles?: number;
    maxParticles?: number;
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
        isParticle: false,
        sprites: [
            "part-blood-explosion-01.img",
            "part-blood-explosion-02.img",
            "part-blood-explosion-03.img",
            "part-blood-explosion-04.img",
            "part-blood-explosion-05.img",
            "part-blood-explosion-06.img",
            "part-blood-explosion-07.img",
            "part-blood-explosion-08.img",
            "part-blood-explosion-09.img",
            "part-blood-explosion-10.img",
        ],
        animationSpeed: 0.25,
        animationScale: 0.7,
    },
    death_confetti: {
        type: "death_effect",
        name: "Confetti",
        rarity: Rarity.Mythic,
        texture: "loot-confetti-death.img",
        particle: "confettiDeath",
        isParticle: true,
        minParticles: 150,
        maxParticles: 150,
    },
    death_sparkle: {
        type: "death_effect",
        name: "Mr Sparkles",
        rarity: Rarity.Mythic,
        texture: "loot-sparkly-death.img",
        particle: "sparklyDeath",
        isParticle: true,
        minParticles: 45,
        maxParticles: 55,
    },
    death_potato: {
        type: "death_effect",
        name: "Potato Blast",
        rarity: Rarity.Epic,
        texture: "loot-potato-blast-death.img",
        particle: "potatoBlastDeath",
        isParticle: true,
        minParticles: 45,
        maxParticles: 55,
    },
    death_toon_blast: {
        type: "death_effect",
        name: "Toon Blast",
        rarity: Rarity.Common,
        texture: "loot-explosive-death.img",
        particle: "explosiveDeath",
        isParticle: false,
        sprites: [
            "death-explosive-1.img",
            "death-explosive-2.img",
            "death-explosive-3.img",
            "death-explosive-4.img",
            "death-explosive-5.img",
            "death-explosive-6.img",
            "death-explosive-7.img",
            "death-explosive-8.img",
        ],
        animationSpeed: 0.2,
        animationScale: 1.3,
    },
    death_turkey_feathers: {
        type: "death_effect",
        name: "Turkey Feathers",
        rarity: Rarity.Rare,
        texture: "loot-perk-turkey_shoot.img",
        particle: "turkeyFeathersDeath",
        isParticle: true,
        minParticles: 30,
        maxParticles: 35,
    },
    death_cupid: {
        type: "death_effect",
        name: "Cupid Hearts",
        rarity: Rarity.Rare,
        texture: "loot-perk-cupid.img",
        particle: "cupidDeath",
        isParticle: true,
        minParticles: 30,
        maxParticles: 35,
    },
    death_black_hole: {
        type: "death_effect",
        name: "Black Hole",
        rarity: Rarity.Epic,
        texture: "loot-black-hole.img",
        particle: "blackHoleDeath",
        particleCount: 15,
        isParticle: false,
        sprites: [
            "part-black-hole-09.img",
            "part-black-hole-08.img",
            "part-black-hole-07.img",
            "part-black-hole-06.img",
            "part-black-hole-05.img",
            "part-black-hole-04.img",
            "part-black-hole-03.img",
            "part-black-hole-02.img",
            "part-black-hole-01.img",
        ],
        animationSpeed: 0.15,
        animationScale: 1.2,
    },
    death_magic_spark: {
        type: "death_effect",
        name: "Magic Sparks",
        rarity: Rarity.Mythic,
        texture: "loot-magic-spark.img",
        particle: "magicSparkDeath",
        isParticle: true,
        minParticles: 30,
        maxParticles: 35,
    },
    death_billionaire: {
        type: "death_effect",
        name: "Billionaire",
        rarity: Rarity.Mythic,
        texture: "loot-billionaire-death.img",
        particle: "billionaireDeath",
        isParticle: true,
        minParticles: 30,
        maxParticles: 35,
    },
};
