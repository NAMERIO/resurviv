import { Rarity } from "../../gameConfig";

export type LootBoxChance = {
    rarity: Rarity;
    weight: number;
};

export type LootBoxDef = {
    id: string;
    name: string;
    price: number;
    source: string;
    chances: LootBoxChance[];
    itemPools: Partial<Record<Rarity, string[]>>;
};

export const lootBoxDefs = {
    loot_box_01: {
        id: "loot_box_01",
        name: "PARMA Crate",
        price: 100,
        source: "PARMA Crate",
        chances: [
            { rarity: Rarity.Common, weight: 70 },
            { rarity: Rarity.Uncommon, weight: 25 },
            { rarity: Rarity.Epic, weight: 5 },
        ],
        itemPools: {
            [Rarity.Common]: [
                "outfitParma",
                "heal_heart",
                "emote_bandagedface",
                "outfitWhite",
                "boost_star",
                "emote_ok",
                "outfitRed",
                "heal_moon",
            ],
            [Rarity.Uncommon]: [
                "emote_pooface",
                "knuckles_rusted",
                "emote_ghost_base",
                "heal_tomoe",
                "emote_picassoface",
                "outfitCarbonFiber",
                "boost_shuriken",
                "emote_rainbow",
            ],
            [Rarity.Epic]: [
                "outfitParmaPrestige",
                "knuckles_heroic",
                "outfitTurkey",
                "bayonet_rugged",
                "bayonet_woodland",
            ],
        },
    },
    loot_box_02: {
        id: "loot_box_02",
        name: "HYDRA Crate",
        price: 250,
        source: "HYDRA Crate",
        chances: [
            { rarity: Rarity.Uncommon, weight: 65 },
            { rarity: Rarity.Epic, weight: 30 },
            { rarity: Rarity.Mythic, weight: 5 },
        ],
        itemPools: {
            [Rarity.Uncommon]: [
                "outfitCarbonFiber",
                "heal_tomoe",
                "emote_picassoface",
                "emote_rainbow",
                "emote_logohydra",
                "fist_split",
            ],
            [Rarity.Epic]: [
                "outfitParmaPrestige",
                "knuckles_heroic",
                "outfitTurkey",
                "bayonet_rugged",
                "emote_trollface",
                "death_confetti",
                "fist_frostpunch",
            ],
            [Rarity.Mythic]: ["outfitChromesis", "death_billionaire", "bayonet_woodland"],
        },
    },
    loot_box_03: {
        id: "loot_box_03",
        name: "REDACTED Crate",
        price: 700,
        source: "REDACTED Crate",
        chances: [
            { rarity: Rarity.Epic, weight: 65 },
            { rarity: Rarity.Mythic, weight: 35 },
        ],
        itemPools: {
            [Rarity.Epic]: [
                "outfitParmaPrestige",
                "outfitTurkey",
                "bayonet_rugged",
                "knuckles_heroic",
                "emote_trollface",
                "death_confetti",
                "fist_frostpunch",
            ],
            [Rarity.Mythic]: [
                "outfitChromesis",
                "outfitSplotchfest",
                "bayonet_woodland",
                "death_billionaire",
                "fist_blueVelvet",
            ],
        },
    },
} satisfies Record<string, LootBoxDef>;
