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
        texture: "loot-death-skull.img",
        particle: "deathSplash",
        particleCount: 0,
    },
    death_basic: {
        type: "death_effect",
        name: "Standard Death",
        rarity: Rarity.Stock,
        texture: "loot-death-basic-puff.img",
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
            "part-death-blood-explosion-01.img",
            "part-death-blood-explosion-02.img",
            "part-death-blood-explosion-03.img",
            "part-death-blood-explosion-04.img",
            "part-death-blood-explosion-05.img",
            "part-death-blood-explosion-06.img",
            "part-death-blood-explosion-07.img",
            "part-death-blood-explosion-08.img",
            "part-death-blood-explosion-09.img",
            "part-death-blood-explosion-10.img",
        ],
        animationSpeed: 0.25,
        animationScale: 0.7,
    },
    death_confetti: {
        type: "death_effect",
        name: "Confetti",
        rarity: Rarity.Mythic,
        texture: "loot-death-confetti.img",
        particle: "confettiDeath",
        isParticle: true,
        minParticles: 150,
        maxParticles: 150,
    },
    death_sparkle: {
        type: "death_effect",
        name: "Mr Sparkles",
        rarity: Rarity.Mythic,
        texture: "loot-death-sparkly.img",
        particle: "sparklyDeath",
        isParticle: true,
        minParticles: 45,
        maxParticles: 55,
    },
    death_potato: {
        type: "death_effect",
        name: "Potato Blast",
        rarity: Rarity.Epic,
        texture: "loot-death-potato-blast.img",
        particle: "potatoBlastDeath",
        isParticle: true,
        minParticles: 45,
        maxParticles: 55,
    },
    death_toon_blast: {
        type: "death_effect",
        name: "Toon Blast",
        rarity: Rarity.Mythic,
        texture: "loot-death-explosive.img",
        particle: "explosiveDeath",
        isParticle: false,
        sprites: [
            "part-death-explosive-01.img",
            "part-death-explosive-02.img",
            "part-death-explosive-03.img",
            "part-death-explosive-04.img",
            "part-death-explosive-05.img",
            "part-death-explosive-06.img",
            "part-death-explosive-07.img",
            "part-death-explosive-08.img",
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
        texture: "loot-death-black-hole.img",
        particle: "blackHoleDeath",
        particleCount: 15,
        isParticle: false,
        sprites: [
            "part-death-black-hole-09.img",
            "part-death-black-hole-08.img",
            "part-death-black-hole-07.img",
            "part-death-black-hole-06.img",
            "part-death-black-hole-05.img",
            "part-death-black-hole-04.img",
            "part-death-black-hole-03.img",
            "part-death-black-hole-02.img",
            "part-death-black-hole-01.img",
        ],
        animationSpeed: 0.15,
        animationScale: 1.2,
    },
    death_magic_spark: {
        type: "death_effect",
        name: "Magic Sparks",
        rarity: Rarity.Mythic,
        texture: "loot-death-magic-spark.img",
        particle: "magicSparkDeath",
        isParticle: true,
        minParticles: 30,
        maxParticles: 35,
    },
    death_billionaire: {
        type: "death_effect",
        name: "Billionaire",
        rarity: Rarity.Mythic,
        texture: "loot-death-billionaire.img",
        particle: "billionaireDeath",
        isParticle: true,
        minParticles: 30,
        maxParticles: 35,
    },
};
