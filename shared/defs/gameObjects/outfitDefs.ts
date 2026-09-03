import { Rarity } from "../../gameConfig";
import { type DeepPartial, util } from "../../utils/util";

export interface OutfitDef {
    readonly type: "outfit";
    name: string;
    skinImg: {
        baseTint: number;
        baseSprite: string;
        handTint: number;
        handSprite: string;
        footTint: number;
        footSprite: string;
        backpackTint: number;
        backpackSprite: string;
        frontSprite?: string;
        frontSpritePos?: { x: number; y: number };
        aboveHand?: Boolean;
    };
    lootImg: {
        /** Use the existing player skin sprites instead of a separate loot sprite. */
        skinLootImg?: boolean;
        sprite: string;
        tint: number;
        border: string;
        borderTint: number;
        scale: number;
    };
    sound: {
        pickup: string;
    };
    baseType?: string;
    noDropOnDeath?: boolean;
    rarity?: number;
    lore?: string;
    noDrop?: boolean;
    obstacleType?: string;
    baseScale?: number;
    ghillie?: boolean;
    moveEmitter?: string;
    /** Render a procedural, world-shifting star field inside the player sprites. */
    galaxyEffect?: boolean;
}

export function getOutfitLootImg(def: OutfitDef): OutfitDef["lootImg"] {
    if (!def.lootImg.skinLootImg) {
        return def.lootImg;
    }

    return {
        ...def.lootImg,
        sprite: def.skinImg.baseSprite,
        tint: def.skinImg.baseTint,
    };
}

function defineOutfitSkin(baseType: string, params: DeepPartial<OutfitDef>): OutfitDef {
    return util.mergeDeep({}, BaseDefs[baseType], params);
}
const BaseDefs: Record<string, OutfitDef> = {
    outfitBase: {
        name: "Basic Outfit",
        type: "outfit",
        skinImg: {
            baseTint: 0xf8c574,
            baseSprite: "player-base-01.img",
            handTint: 0xf8c574,
            handSprite: "player-hands-01.img",
            footTint: 0xf8c574,
            footSprite: "player-feet-01.img",
            backpackTint: 0x816537,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            sprite: "loot-outfit-01.img",
            tint: 0xffffff,
            border: "loot-circle-outer-01.img",
            borderTint: 0,
            scale: 0.2,
        },
        sound: {
            pickup: "clothes_pickup_01",
        },
    },
};

const SkinDefs: Record<string, OutfitDef> = {
    // ============ JUSTIN & NICK OUTFITS ============
    // === Basics ===
    outfitBase: defineOutfitSkin("outfitBase", {
        noDropOnDeath: true,
        name: "Basic Outfit",
        rarity: Rarity.Stock,
        lore: "Pure and simple.",
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitDemo: defineOutfitSkin("outfitBase", {
        noDrop: true,
        rarity: Rarity.Stock,
        skinImg: {
            baseTint: 0xc76a67,
            baseSprite: "player-base-02.img",
            handTint: 0xb5504d,
            handSprite: "player-hands-02.img",
            footTint: 0xb5504d,
            footSprite: "player-feet-02.img",
            backpackTint: 0x9e3734,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitTank: defineOutfitSkin("outfitBase", {
        noDrop: true,
        skinImg: {
            baseTint: 0xeab963,
            baseSprite: "player-base-02.img",
            handTint: 0xd8a44b,
            handSprite: "player-hands-02.img",
            footTint: 0xd8a44b,
            footSprite: "player-feet-02.img",
            backpackTint: 0xbf8b2f,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitMedic: defineOutfitSkin("outfitBase", {
        noDrop: true,
        skinImg: {
            baseTint: 0xdc79dc,
            baseSprite: "player-base-02.img",
            handTint: 0xc454c4,
            handSprite: "player-hands-02.img",
            footTint: 0xc454c4,
            footSprite: "player-feet-02.img",
            backpackTint: 0xa937a9,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitScout: defineOutfitSkin("outfitBase", {
        noDrop: true,
        skinImg: {
            baseTint: 0xacd563,
            baseSprite: "player-base-02.img",
            handTint: 0x96c24a,
            handSprite: "player-hands-02.img",
            footTint: 0x96c24a,
            footSprite: "player-feet-02.img",
            backpackTint: 0x83b034,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSniper: defineOutfitSkin("outfitBase", {
        noDrop: true,
        skinImg: {
            baseTint: 0x8dcedb,
            baseSprite: "player-base-02.img",
            handTint: 0x70bac9,
            handSprite: "player-hands-02.img",
            footTint: 0x70bac9,
            footSprite: "player-feet-02.img",
            backpackTint: 0x52a3b4,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitAssault: defineOutfitSkin("outfitBase", {
        noDrop: true,
        skinImg: {
            baseTint: 0xdacf59,
            baseSprite: "player-base-02.img",
            handTint: 0xc6bb40,
            handSprite: "player-hands-02.img",
            footTint: 0xc6bb40,
            footSprite: "player-feet-02.img",
            backpackTint: 0xa69c28,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    // === Regular ===
    outfitWheat: defineOutfitSkin("outfitBase", {
        name: "Splintered Wheat",
        rarity: Rarity.Stock,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitWheat.img",
            handTint: 0xf0dd92,
            handSprite: "player-hands-01.img",
            footTint: 0xf0dd92,
            footSprite: "player-feet-01.img",
            backpackTint: 0xcba81d,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitNoir: defineOutfitSkin("outfitBase", {
        name: "Neo Noir",
        skinImg: {
            baseTint: 0x1b1b1b,
            baseSprite: "player-base-02.img",
            handTint: 0xffffff,
            handSprite: "player-hands-02.img",
            footTint: 0xffffff,
            footSprite: "player-feet-02.img",
            backpackTint: 0x777777,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x1b1b1b,
        },
    }),
    outfitRedLeaderAged: defineOutfitSkin("outfitBase", {
        name: "Weathered Red",
        skinImg: {
            baseTint: 0x9a1818,
            baseSprite: "player-base-02.img",
            handTint: 0xff0000,
            handSprite: "player-hands-02.img",
            footTint: 0xff0000,
            footSprite: "player-feet-02.img",
            backpackTint: 0x530c0c,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x9a1818,
        },
    }),
    outfitBlueLeaderAged: defineOutfitSkin("outfitBase", {
        name: "Stifled Blue",
        skinImg: {
            baseTint: 0x173e99,
            baseSprite: "player-base-02.img",
            handTint: 0x4eff,
            handSprite: "player-hands-02.img",
            footTint: 0x4eff,
            footSprite: "player-feet-02.img",
            backpackTint: 794700,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x173e99,
        },
    }),
    outfitRedLeader: defineOutfitSkin("outfitBase", {
        name: "Red Leader",
        noDrop: true,
        skinImg: {
            baseTint: 0x9b0000,
            baseSprite: "player-base-02.img",
            handTint: 0xff0000,
            handSprite: "player-hands-02.img",
            footTint: 0xff0000,
            footSprite: "player-feet-02.img",
            backpackTint: 0x530000,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x840000,
        },
    }),
    outfitBlueLeader: defineOutfitSkin("outfitBase", {
        name: "Blue Leader",
        noDrop: true,
        skinImg: {
            baseTint: 0x2f9b,
            baseSprite: "player-base-02.img",
            handTint: 0x4eff,
            handSprite: "player-hands-02.img",
            footTint: 0x4eff,
            footSprite: "player-feet-02.img",
            backpackTint: 0x174c,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 13223,
        },
    }),
    outfitSpetsnaz: defineOutfitSkin("outfitBase", {
        name: "Siberian Assault",
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitSpetsnaz.img",
            handTint: 0xe4e4e4,
            handSprite: "player-hands-01.img",
            footTint: 0xe4e4e4,
            footSprite: "player-feet-01.img",
            backpackTint: 0xd2d2d2,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitWoodsCloak: defineOutfitSkin("outfitBase", {
        name: "Greencloak",
        skinImg: {
            baseTint: 0x2aff00,
            baseSprite: "player-base-02.img",
            handTint: 0xfeffaa,
            handSprite: "player-hands-02.img",
            footTint: 0xfeffaa,
            footSprite: "player-feet-02.img",
            backpackTint: 0xee9347,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x2aff00,
        },
    }),
    outfitElf: defineOutfitSkin("outfitBase", {
        name: "Tallow's Little Helper",
        skinImg: {
            baseTint: 0xc40000,
            baseSprite: "player-base-01.img",
            handTint: 0x16b900,
            handSprite: "player-hands-01.img",
            footTint: 0x16b900,
            footSprite: "player-feet-01.img",
            backpackTint: 0x59300,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x16b900,
        },
    }),
    outfitImperial: defineOutfitSkin("outfitBase", {
        name: "Imperial Seal",
        skinImg: {
            baseTint: 0xbc002d,
            baseSprite: "player-base-01.img",
            handTint: 0xffffff,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xc0a73f,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xbc002d,
        },
    }),
    outfitLumber: defineOutfitSkin("outfitBase", {
        name: "Woodcutter's Wrap",
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitLumber.img",
            handTint: 0x7e0308,
            handSprite: "player-hands-02.img",
            footTint: 0x7e0308,
            footSprite: "player-feet-02.img",
            backpackTint: 0x4a1313,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitVerde: defineOutfitSkin("outfitBase", {
        name: "Poncho Verde",
        skinImg: {
            baseTint: 0x1b400c,
            baseSprite: "player-base-02.img",
            handTint: 0xb5c58b,
            handSprite: "player-hands-02.img",
            footTint: 0xb5c58b,
            footSprite: "player-feet-02.img",
            backpackTint: 0xab7c29,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x1b400c,
        },
    }),
    outfitPineapple: defineOutfitSkin("outfitBase", {
        name: "Valiant Pineapple",
        skinImg: {
            baseTint: 0x990000,
            baseSprite: "player-base-02.img",
            handTint: 0x4c1111,
            handSprite: "player-hands-02.img",
            footTint: 0x4c1111,
            footSprite: "player-feet-02.img",
            backpackTint: 0xffcc00,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x990000,
        },
    }),
    outfitTarkhany: defineOutfitSkin("outfitBase", {
        name: "Tarkhany Regal",
        skinImg: {
            baseTint: 0x4b2e83,
            baseSprite: "player-base-02.img",
            handTint: 0xffb400,
            handSprite: "player-hands-02.img",
            footTint: 0xffb400,
            footSprite: "player-feet-02.img",
            backpackTint: 0x472060,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x4b2e83,
        },
    }),
    outfitWaterElem: defineOutfitSkin("outfitBase", {
        name: "Water Elemental",
        skinImg: {
            baseTint: 0x6cffe9,
            baseSprite: "player-base-02.img",
            handTint: 0xf4005c,
            handSprite: "player-hands-02.img",
            footTint: 0xf4005c,
            footSprite: "player-feet-02.img",
            backpackTint: 0x7f84,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 7143401,
        },
    }),
    outfitHeaven: defineOutfitSkin("outfitBase", {
        name: "Celestial Garb",
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitHeaven.img",
            handTint: 0xd2004f,
            handSprite: "player-hands-02.img",
            footTint: 0xd2004f,
            footSprite: "player-feet-02.img",
            backpackTint: 0x8e97,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitMeteor: defineOutfitSkin("outfitBase", {
        name: "Falling Star",
        skinImg: {
            baseTint: 0x950000,
            baseSprite: "player-base-02.img",
            handTint: 0xff7800,
            handSprite: "player-hands-02.img",
            footTint: 0xff7800,
            footSprite: "player-feet-02.img",
            backpackTint: 0x48231e,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x950000,
        },
    }),
    outfitIslander: defineOutfitSkin("outfitBase", {
        name: "Island Time",
        skinImg: {
            baseTint: 0xffc600,
            baseSprite: "player-base-01.img",
            handTint: 0x24600,
            handSprite: "player-hands-01.img",
            footTint: 0x24600,
            footSprite: "player-feet-01.img",
            backpackTint: 0x449700,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffc600,
        },
    }),
    outfitAqua: defineOutfitSkin("outfitBase", {
        name: "Aquatic Avenger",
        skinImg: {
            baseTint: 0xbaa2,
            baseSprite: "player-base-01.img",
            handTint: 0xffde,
            handSprite: "player-hands-01.img",
            footTint: 0xffde,
            footSprite: "player-feet-01.img",
            backpackTint: 0x8302c,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xbaa2,
        },
    }),
    outfitCoral: defineOutfitSkin("outfitBase", {
        name: "Coral Guise",
        skinImg: {
            baseTint: 0xff5f67,
            baseSprite: "player-base-01.img",
            handTint: 0xff898f,
            handSprite: "player-hands-01.img",
            footTint: 0xff898f,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffecca,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xff5f67,
        },
    }),
    outfitKhaki: defineOutfitSkin("outfitBase", {
        name: "The Initiative",
        rarity: Rarity.Common,
        skinImg: {
            baseTint: 0xc3ae85,
            baseSprite: "player-base-02.img",
            handTint: 0x8f8064,
            handSprite: "player-hands-02.img",
            footTint: 0x8f8064,
            footSprite: "player-feet-02.img",
            backpackTint: 0x40392c,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xc3ae85,
        },
    }),
    outfitCasanova: defineOutfitSkin("outfitBase", {
        name: "Casanova Silks",
        skinImg: {
            baseTint: 0x42080c,
            baseSprite: "player-base-01.img",
            handTint: 0x740007,
            handSprite: "player-hands-01.img",
            footTint: 0x740007,
            footSprite: "player-feet-01.img",
            backpackTint: 0x101010,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x42080c,
        },
    }),
    outfitPrisoner: defineOutfitSkin("outfitBase", {
        name: "The New Black",
        skinImg: {
            baseTint: 0xff5c22,
            baseSprite: "player-base-01.img",
            handTint: 0xfc7523,
            handSprite: "player-hands-01.img",
            footTint: 0xfc7523,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffae00,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xff5c22,
        },
    }),
    outfitJester: defineOutfitSkin("outfitBase", {
        name: "Jester's Folly",
        skinImg: {
            baseTint: 0x770078,
            baseSprite: "player-base-01.img",
            handTint: 0x4b004c,
            handSprite: "player-hands-01.img",
            footTint: 0x4b004c,
            footSprite: "player-feet-01.img",
            backpackTint: 0xe4c00,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x770078,
        },
    }),
    outfitWoodland: defineOutfitSkin("outfitBase", {
        name: "Woodland Combat",
        rarity: Rarity.Common,
        lore: "Common component of PARMA survival caches.",
        skinImg: {
            baseTint: 0x2b332a,
            baseSprite: "player-base-01.img",
            handTint: 0x5a6c52,
            handSprite: "player-hands-01.img",
            footTint: 0x5a6c52,
            footSprite: "player-feet-01.img",
            backpackTint: 0x4d2600,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitRoyalFortune: defineOutfitSkin("outfitBase", {
        name: "Royal Fortune",
        rarity: Rarity.Rare,
        skinImg: {
            baseTint: 0x7f2723,
            baseSprite: "player-base-01.img",
            handTint: 0xe8c22a,
            handSprite: "player-hands-01.img",
            footTint: 0xe8c22a,
            footSprite: "player-feet-01.img",
            backpackTint: 0x984f00,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitKeyLime: defineOutfitSkin("outfitBase", {
        name: "Key Lime",
        rarity: Rarity.Common,
        lore: "Not for eating.",
        skinImg: {
            baseTint: 0xc7ff3f,
            baseSprite: "player-base-01.img",
            handTint: 0xeeff5d,
            handSprite: "player-hands-01.img",
            footTint: 0xeeff5d,
            footSprite: "player-feet-01.img",
            backpackTint: 0xbc8737,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitCobaltShell: defineOutfitSkin("outfitBase", {
        name: "Cobalt Shell",
        rarity: Rarity.Common,
        lore: "It means bluish.",
        skinImg: {
            baseTint: 0x2b57,
            baseSprite: "player-base-01.img",
            handTint: 0x295e7c,
            handSprite: "player-hands-01.img",
            footTint: 0x295e7c,
            footSprite: "player-feet-01.img",
            backpackTint: 0x4a95,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitDarkShirt: defineOutfitSkin("outfitBase", {
        name: "The Semi-Pro",
        noDropOnDeath: true,
        rarity: Rarity.Stock,
        lore: "Some survivrs wear the dark shirt.",
        skinImg: {
            baseTint: 0xbe7800,
            baseSprite: "player-base-01.img",
            handTint: 0xf8c574,
            handSprite: "player-hands-01.img",
            footTint: 0xf8c574,
            footSprite: "player-feet-01.img",
            backpackTint: 0xe7ae53,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitGhillie: defineOutfitSkin("outfitBase", {
        name: "Ghillie Suit",
        ghillie: true,
        skinImg: {
            baseTint: 0x83af50,
            baseSprite: "player-base-01.img",
            handTint: 0x83af50,
            handSprite: "player-hands-01.img",
            footTint: 0x83af50,
            footSprite: "player-feet-01.img",
            backpackTint: 0x663300,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x83af50,
        },
    }),
    outfitDesertCamo: defineOutfitSkin("outfitBase", {
        name: "Desert Camo",
        rarity: Rarity.Common,
        skinImg: {
            baseTint: 0xd19b4e,
            baseSprite: "player-base-01.img",
            handTint: 0xaa6d16,
            handSprite: "player-hands-01.img",
            footTint: 0xaa6d16,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffcb82,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitCamo: defineOutfitSkin("outfitBase", {
        name: "Forest Camo",
        rarity: Rarity.Common,
        lore: "Be one with the trees.",
        skinImg: {
            baseTint: 0x999966,
            baseSprite: "player-base-01.img",
            handTint: 0x848457,
            handSprite: "player-hands-01.img",
            footTint: 0x848457,
            footSprite: "player-feet-01.img",
            backpackTint: 0x666633,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    // === Exclusives ===
    outfitDev: defineOutfitSkin("outfitBase", {
        name: "Developer Swag",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0x348628,
            baseSprite: "player-base-outfitDC.img",
            handTint: 0x69da22,
            handSprite: "player-hands-02.img",
            footTint: 0x69da22,
            footSprite: "player-feet-02.img",
            backpackTint: 0x2c4b09,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: Rarity.Mythic,
        lore: "The limited edition print.",
    }),
    outfitGD: defineOutfitSkin("outfitBase", {
        name: "Game Designr",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xab3030,
            baseSprite: "player-base-outfitDC.img",
            handTint: 0xe35f5f,
            handSprite: "player-hands-02.img",
            footTint: 0xe35f5f,
            footSprite: "player-feet-02.img",
            backpackTint: 0x6e1010,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: Rarity.Epic,
        lore: "For those who knows.",
    }),
    outfitMod: defineOutfitSkin("outfitBase", {
        name: "Game Moderatr",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0x3393db,
            baseSprite: "player-base-outfitDC.img",
            handTint: 0x93c7ee,
            handSprite: "player-hands-02.img",
            footTint: 0x93c7ee,
            footSprite: "player-feet-02.img",
            backpackTint: 0x175686,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: Rarity.Rare,
        lore: "For those who wield the power of the pan.",
    }),
    // === Halloween costumes ===
    outfitBarrel: defineOutfitSkin("outfitBase", {
        name: "Barrel Costume",
        obstacleType: "barrel_01",
        baseScale: 0.8,
        rarity: Rarity.Common,
        lootImg: {
            tint: 0x393939,
        },
    }),
    outfitWoodBarrel: defineOutfitSkin("outfitBase", {
        name: "Wood Barrel Costume",
        obstacleType: "barrel_02",
        baseScale: 1,
        lootImg: {
            tint: 0xab6f22,
        },
    }),
    outfitStone: defineOutfitSkin("outfitBase", {
        name: "Stone Costume",
        obstacleType: "stone_01",
        baseScale: 0.9,
        lootImg: {
            tint: 0x717171,
        },
    }),
    outfitSpringTree: defineOutfitSkin("outfitBase", {
        name: "Tree Costume",
        obstacleType: "tree_07sp",
        baseScale: 1,
        lootImg: {
            tint: 0x462d12,
        },
    }),
    outfitHalloweenTree: defineOutfitSkin("outfitBase", {
        name: "Tree Costume",
        obstacleType: "tree_07",
        baseScale: 1,
        lootImg: {
            tint: 0x462d12,
        },
    }),
    outfitTree: defineOutfitSkin("outfitBase", {
        name: "Tree Costume",
        obstacleType: "tree_07",
        baseScale: 1,
        lootImg: {
            tint: 0x462d12,
        },
    }),
    outfitTreeSpooky: defineOutfitSkin("outfitBase", {
        name: "Spooky Tree Costume",
        obstacleType: "tree_05",
        baseScale: 1,
        lootImg: {
            tint: 0x1b1917,
        },
    }),
    outfitStump: defineOutfitSkin("outfitBase", {
        name: "Stump Costume",
        obstacleType: "tree_09",
        baseScale: 1,
        lootImg: {
            tint: 0x834400,
        },
    }),
    outfitBush: defineOutfitSkin("outfitBase", {
        name: "Bush Costume",
        obstacleType: "bush_01b",
        baseScale: 1,
        lootImg: {
            tint: 0x3b5b1f,
        },
    }),
    outfitLeafPile: defineOutfitSkin("outfitBase", {
        name: "Leaf Pile Costume",
        obstacleType: "bush_06b",
        baseScale: 1,
        lootImg: {
            tint: 0xff4d00,
        },
    }),
    outfitCrate: defineOutfitSkin("outfitBase", {
        name: "Crate Costume",
        obstacleType: "crate_01",
        baseScale: 1,
        lootImg: {
            tint: 0x663300,
        },
    }),
    outfitTable: defineOutfitSkin("outfitBase", {
        name: "Table Costume",
        obstacleType: "table_01",
        baseScale: 1,
        lootImg: {
            tint: 0x663300,
        },
    }),
    outfitSoviet: defineOutfitSkin("outfitBase", {
        name: "Soviet Costume",
        obstacleType: "crate_02",
        baseScale: 1,
        lootImg: {
            tint: 0x663300,
        },
    }),
    outfitAirdrop: defineOutfitSkin("outfitBase", {
        name: "Air Drop Costume",
        obstacleType: "crate_10",
        baseScale: 1,
        lootImg: {
            tint: 0x646464,
        },
    }),
    outfitOven: defineOutfitSkin("outfitBase", {
        name: "Oven Costume",
        obstacleType: "oven_01",
        baseScale: 1,
        lootImg: {
            tint: 0xe3e3e3,
        },
    }),
    outfitRefrigerator: defineOutfitSkin("outfitBase", {
        name: "Fridge Costume",
        obstacleType: "refrigerator_01b",
        baseScale: 1,
        lootImg: {
            tint: 0x76000b,
        },
    }),
    outfitVending: defineOutfitSkin("outfitBase", {
        name: "Vending Costume",
        obstacleType: "vending_01",
        baseScale: 1,
        lootImg: {
            tint: 0x2aad,
        },
    }),
    outfitPumpkin: defineOutfitSkin("outfitBase", {
        name: "Pumpkin Costume",
        obstacleType: "pumpkin_01",
        baseScale: 1,
        lootImg: {
            tint: 0xf27503,
        },
    }),
    outfitWoodpile: defineOutfitSkin("outfitBase", {
        name: "Woodpile Costume",
        obstacleType: "woodpile_01",
        baseScale: 1,
        lootImg: {
            tint: 0x904800,
        },
    }),
    outfitToilet: defineOutfitSkin("outfitBase", {
        name: "Toilet Costume",
        obstacleType: "toilet_02",
        baseScale: 1,
        lootImg: {
            tint: 0xffffff,
        },
    }),
    outfitBushRiver: defineOutfitSkin("outfitBase", {
        name: "River Bush Costume",
        obstacleType: "bush_04",
        baseScale: 1,
        lootImg: {
            tint: 0x517b2a,
        },
    }),
    outfitCrab: defineOutfitSkin("outfitBase", {
        name: "Crab Pot Costume",
        obstacleType: "crate_20",
        baseScale: 1,
        lootImg: {
            tint: 0xfd3018,
        },
    }),
    outfitStumpAxe: defineOutfitSkin("outfitBase", {
        name: "Stump Axe Costume",
        obstacleType: "tree_02h",
        baseScale: 1,
        lootImg: {
            tint: 0xa9621d,
        },
    }),
    // === Pass 1 ===
    outfitParma: defineOutfitSkin("outfitBase", {
        name: "PARMA Jumpsuit",
        noDropOnDeath: true,
        rarity: Rarity.Common,
        lore: "Next generation inversion.",
        skinImg: {
            baseTint: 0x857659,
            baseSprite: "player-base-01.img",
            handTint: 0xc3ae85,
            handSprite: "player-hands-01.img",
            footTint: 0xc3ae85,
            footSprite: "player-feet-01.img",
            backpackTint: 0x40392c,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitWhite: defineOutfitSkin("outfitBase", {
        name: "Arctic Avenger",
        // noDropOnDeath: true,
        rarity: Rarity.Common,
        lore: "No business like snow business.",
        skinImg: {
            baseTint: 0xe3e3e3,
            baseSprite: "player-base-01.img",
            handTint: 0xeeeeee,
            handSprite: "player-hands-01.img",
            footTint: 0xeeeeee,
            footSprite: "player-feet-01.img",
            backpackTint: 0xdcdcdc,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitRed: defineOutfitSkin("outfitBase", {
        name: "Target Practice",
        // noDropOnDeath: true,
        rarity: Rarity.Uncommon,
        lore: "On the plus side, they won't see you bleed.",
        skinImg: {
            baseTint: 0xff0000,
            baseSprite: "player-base-01.img",
            handTint: 0xd40000,
            handSprite: "player-hands-01.img",
            footTint: 0xd40000,
            footSprite: "player-feet-01.img",
            backpackTint: 0xb70000,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitDarkGloves: defineOutfitSkin("outfitBase", {
        name: "The Professional",
        // noDropOnDeath: true,
        rarity: Rarity.Common,
        lore: "True survivrs wear the dark gloves.",
        skinImg: {
            baseTint: 0xf8c574,
            baseSprite: "player-base-01.img",
            handTint: 0xbe7800,
            handSprite: "player-hands-01.img",
            footTint: 0xbe7800,
            footSprite: "player-feet-01.img",
            backpackTint: 0xa36700,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitCarbonFiber: defineOutfitSkin("outfitBase", {
        name: "Carbon Fiber",
        // noDropOnDeath: true,
        rarity: Rarity.Uncommon,
        lore: "Military-grade, fine spun filament.",
        skinImg: {
            baseTint: 0x212121,
            baseSprite: "player-base-01.img",
            handTint: 0x1c1c1c,
            handSprite: "player-hands-01.img",
            footTint: 0x1c1c1c,
            footSprite: "player-feet-01.img",
            backpackTint: 0x363636,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitParmaPrestige: defineOutfitSkin("outfitBase", {
        name: "The Core Jumpsuit",
        noDropOnDeath: true,
        rarity: Rarity.Rare,
        lore: "Special issue for staffers at Bunker 1.",
        skinImg: {
            baseTint: 0xe3c081,
            baseSprite: "player-base-outfitParmaPrestige.img",
            handTint: 0xa9936b,
            handSprite: "player-hands-02.img",
            footTint: 0xa9936b,
            footSprite: "player-feet-02.img",
            backpackTint: 0x655231,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitTurkey: defineOutfitSkin("outfitBase", {
        name: "Fowl Facade",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xf0cebb,
            baseSprite: "player-base-outfitTurkey.img",
            handTint: 0xa51300,
            handSprite: "player-hands-02.img",
            footTint: 0xa51300,
            footSprite: "player-feet-02.img",
            backpackTint: 0xa85526,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xf0cebb,
        },
        rarity: Rarity.Rare,
        lore: "M1100 not included.",
    }),
    // ============ KONGREGATE OUTFITS ============
    // === Added with LTMs ===
    outfitWinter: defineOutfitSkin("outfitBase", {
        name: "Winter Onesie",
        noDropOnDeath: true,
        rarity: 3,
        lore: "Sleep well.",
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitWinter.img",
            handTint: 0xffffff,
            handSprite: "player-hands-winter.img",
            footTint: 0x3f99bf,
            footSprite: "player-feet-02.img",
            backpackTint: 0x3f99bf,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitGeometric: defineOutfitSkin("outfitBase", {
        name: "Geometric",
        noDropOnDeath: true,

        rarity: 3,
        lore: "What a square.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitGeometric.img",
            handTint: 0xffffff,
            handSprite: "player-hands-geometric.img",
            footTint: 0x085050,
            footSprite: "player-feet-02.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-geometric.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitMilitary: defineOutfitSkin("outfitBase", {
        name: "Military",
        noDropOnDeath: true,

        rarity: 3,
        lore: "Hide now.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitMilitary.img",
            handTint: 0xffffff,
            handSprite: "player-hands-military.img",
            footTint: 0x4a5b42,
            footSprite: "player-feet-02.img",
            backpackTint: 0x0f120d,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitWhiteDay: defineOutfitSkin("outfitBase", {
        noDropOnDeath: true,
        name: "Marshmallow Suit",
        rarity: 1,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitWhiteDay.img",
            handTint: 0xffffff,
            handSprite: "player-hands-white.img",
            footTint: 0xc6bb40,
            footSprite: "player-feet-02.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-white-day.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSpeedo: defineOutfitSkin("outfitBase", {
        name: "Speedo",
        rarity: 1,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitSpeedo.img",
            handTint: 0xf4b4ff,
            handSprite: "player-hands-01.img",
            footTint: 0xf4b4ff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x959595,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    // === Winter outfits ===
    outfitSnowman: defineOutfitSkin("outfitBase", {
        name: "Snowman",
        noDropOnDeath: true,
        rarity: 4,
        lore: "",
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-snowman.img",
            handTint: 0xd40000,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xc02727,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 3, y: 0 },
            frontSprite: "player-accessory-snowman.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitGrinch: defineOutfitSkin("outfitBase", {
        name: "Grinch",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-grinch.img",
            handTint: 0xffffff,
            handSprite: "player-hands-grinch.img",
            footTint: 0x617700,
            footSprite: "player-feet-01.img",
            backpackTint: 0xc02727,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 5,
        lore: "For those who wield the power of the pan.",
    }),
    outfitChristmasTree: defineOutfitSkin("outfitBase", {
        name: "Christmas Tree",
        noDropOnDeath: true,
        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-christmastree.img",
            handTint: 0xffffff,
            handSprite: "player-hands-christmastree.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xc02727,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBuckTeeth: defineOutfitSkin("outfitBase", {
        name: "Buck Teeth",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0x3f2b16,
            baseSprite: "player-base-01.img",
            handTint: 0xffffff,
            handSprite: "player-hands-deer.img",
            footTint: 0x232323,
            footSprite: "player-feet-01.img",
            backpackTint: 0x232323,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 5, y: 0 },
            frontSprite: "player-accessory-buck-teeth.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitPoinsetee: defineOutfitSkin("outfitBase", {
        name: "Poinsetee",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0x253600,
            baseSprite: "player-base-01.img",
            handTint: 0xf6e781,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x603008,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -3, y: 0 },
            frontSprite: "player-accessory-poinsetee.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSnowyClaus: defineOutfitSkin("outfitBase", {
        name: "Snowy Claus",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-snowy-claus.img",
            handTint: 0xffffff,
            handSprite: "player-hands-snowy-claus.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x603008,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -1, y: 1.4 },
            frontSprite: "player-accessory-snowy-claus.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitCamoDeer: defineOutfitSkin("outfitBase", {
        name: "Camo Deer",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-camo-deer.img",
            handTint: 0xffffff,
            handSprite: "player-hands-deer.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x232323,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 5, y: 0 },
            frontSprite: "player-accessory-camo-deer.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitChemisTree: defineOutfitSkin("outfitBase", {
        name: "Chemis-tree",
        noDropOnDeath: true,
        rarity: 3,
        lore: "",
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-chemis-tree.img",
            handTint: 0xffffff,
            handSprite: "player-hands-chemis-tree.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x08333f,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    // === Pass 2 ===
    outfitDeepPurple: defineOutfitSkin("outfitBase", {
        name: "Deep Purple",
        noDropOnDeath: true,

        rarity: 1,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitDeepPurple.img",
            handTint: 0x917b9e,
            handSprite: "player-hands-01.img",
            footTint: 0x907b9e,
            footSprite: "player-feet-01.img",
            backpackTint: 0x91809f,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitClaymore: defineOutfitSkin("outfitBase", {
        name: "Clay More",
        noDropOnDeath: true,

        rarity: 1,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitClayMore.img",
            handTint: 0xa8502a,
            handSprite: "player-hands-01.img",
            footTint: 0xa8502a,
            footSprite: "player-feet-01.img",
            backpackTint: 0xee8781,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSplotchfest: defineOutfitSkin("outfitBase", {
        name: "Splotchfest",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitSplotchfest.img",
            handTint: 0x63a73c,
            handSprite: "player-hands-01.img",
            footTint: 0x63a73c,
            footSprite: "player-feet-01.img",
            backpackTint: 0x63a73c,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSunset: defineOutfitSkin("outfitBase", {
        name: "Sunset",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitSunset.img",
            handTint: 0xbe89ab,
            handSprite: "player-hands-01.img",
            footTint: 0xbe89ab,
            footSprite: "player-feet-01.img",
            backpackTint: 0x628ac9,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitChromesis: defineOutfitSkin("outfitBase", {
        name: "Chromesis",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitChromesis.img",
            handTint: 0xffffff,
            handSprite: "player-hands-chrome.img",
            footTint: 0xffffff,
            footSprite: "player-hands-chrome.img",
            backpackTint: 9803157,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -5, y: 0 },
            frontSprite: "player-accessory-outfitChromesis.img",
            aboveHand: false,
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 5,
        lore: "For those who wield the power of the pan.",
    }),
    // === Pass 3 ===
    outfitUrbanCamo: defineOutfitSkin("outfitBase", {
        name: "Urban Camo",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitUrbanCamo.img",
            handTint: 0x2b405c,
            handSprite: "player-hands-01.img",
            footTint: 0x2b405c,
            footSprite: "player-feet-01.img",
            backpackTint: 0xa5b2ca,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitGiraffe: defineOutfitSkin("outfitBase", {
        name: "Giraffe",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitGiraffe.img",
            handTint: 0xf1b644,
            handSprite: "player-hands-01.img",
            footTint: 0xf1b644,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-giraffe.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitRusticSands: defineOutfitSkin("outfitBase", {
        name: "Rustic Sands",
        noDropOnDeath: true,

        rarity: 1,
        lore: "Created by FrankzeeTank",

        skinImg: {
            baseTint: 0xfada78,
            baseSprite: "player-base-01.img",
            handTint: 0x714216,
            handSprite: "player-hands-01.img",
            footTint: 0x714216,
            footSprite: "player-feet-01.img",
            backpackTint: 0x7b2817,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitWaves: defineOutfitSkin("outfitBase", {
        name: "Waves",
        noDropOnDeath: true,

        rarity: 2,
        lore: "Created by Fonpard",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitWaves.img",
            handTint: 0x3c7598,
            handSprite: "player-hands-01.img",
            footTint: 0x3c7598,
            footSprite: "player-feet-01.img",
            backpackTint: 0x153445,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitCow: defineOutfitSkin("outfitBase", {
        name: "Cow",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitCow.img",
            handTint: 0xffffff,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitFragtastic: defineOutfitSkin("outfitBase", {
        name: "Fragtastic",
        rarity: Rarity.Common,
        lore: "Pin not included. Maybe.",
        skinImg: {
            baseTint: 0x62591f,
            baseSprite: "player-base-01.img",
            handTint: 0x7f742a,
            handSprite: "player-hands-01.img",
            footTint: 0x7f742a,
            footSprite: "player-feet-01.img",
            backpackTint: 0x999999,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x938632,
        },
    }),
    outfitZebra: defineOutfitSkin("outfitBase", {
        name: "Zebra",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitZebra.img",
            handTint: 0xffffff,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x101010,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitFireball: defineOutfitSkin("outfitBase", {
        name: "Fireball",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xbb2b10,
            baseSprite: "player-base-01.img",
            handTint: 0xffffff,
            handSprite: "player-hands-outfitFireball.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xd03215,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -4, y: 0 },
            frontSprite: "player-accessory-outfitFireball.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 5,
        lore: "For those who wield the power of the pan.",
    }),
    // === Pass 4 ===
    outfitMango: defineOutfitSkin("outfitBase", {
        name: "Smoothie",
        noDropOnDeath: true,

        rarity: 2,
        lore: "Created by Calieh",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitMango.img",
            handTint: 0xffffff,
            handSprite: "player-hands-outfitMango.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x7d663e,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitNeonEyesore: defineOutfitSkin("outfitBase", {
        name: "Neon",
        noDropOnDeath: true,

        rarity: 3,
        lore: "Created by Savage_Wuhan (Jerrie123)",

        skinImg: {
            baseTint: 0x74fcfd,
            baseSprite: "player-base-01.img",
            handTint: 0x75fa4c,
            handSprite: "player-hands-01.img",
            footTint: 0x75fa4c,
            footSprite: "player-feet-01.img",
            backpackTint: 0xfffe55,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitInfernoCamo: defineOutfitSkin("outfitBase", {
        name: "Magma Camo",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitInferno.img",
            handTint: 0xe85f0a,
            handSprite: "player-hands-01.img",
            footTint: 0xe85f0a,
            footSprite: "player-feet-01.img",
            backpackTint: 0xe85f0a,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitParrot: defineOutfitSkin("outfitBase", {
        name: "Parakeet",
        noDropOnDeath: true,

        rarity: 1,
        lore: "Created by Mxstyc",

        skinImg: {
            baseTint: 0x48742c,
            baseSprite: "player-base-01.img",
            handTint: 0xeac352,
            handSprite: "player-hands-01.img",
            footTint: 0xeac352,
            footSprite: "player-feet-01.img",
            backpackTint: 0xbc261a,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSpeedoSunburn: defineOutfitSkin("outfitBase", {
        name: "Speedo Sunburn",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitSpeedoSunburn.img",
            handTint: 0xf4b4ff,
            handSprite: "player-hands-01.img",
            footTint: 0xf4b4ff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xfe0f16,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 2,
        lore: "For those who wield the power of the pan.",
    }),
    outfitMojo: defineOutfitSkin("outfitBase", {
        name: "Mojo",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitMojo.img",
            handTint: 0xe6c70d,
            handSprite: "player-hands-01.img",
            footTint: 0xe6c70d,
            footSprite: "player-feet-01.img",
            backpackTint: 0x101010,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitAstronaut: defineOutfitSkin("outfitBase", {
        name: "Space Dude",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-astronaut.img",
            handTint: 0xffffff,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-astronaut.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-outfitAstronaut.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBlueLava: defineOutfitSkin("outfitBase", {
        name: "Cold Magma",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitBlueLava.img",
            handTint: 0xffffff,
            handSprite: "player-hands-outfitBlueLava.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-outfitBlueLava.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    // === Pass 5 ===
    outfitCrusader: defineOutfitSkin("outfitBase", {
        name: "Crusader",
        noDropOnDeath: true,

        rarity: 2,
        lore: "Created by avika",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-crusader.img",
            handTint: 0x214724,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xba2b28,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitLasrDisk: defineOutfitSkin("outfitBase", {
        name: "Lasr Disk",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-lasr-disk.img",
            handTint: 0x979797,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x101010,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBeachCamo: defineOutfitSkin("outfitBase", {
        name: "Beach Camo",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-beach-camo.img",
            handTint: 0xa5b85d,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x78a65a,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitForest: defineOutfitSkin("outfitBase", {
        name: "Forest",
        noDropOnDeath: true,

        rarity: 1,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-forest.img",
            handTint: 0xa3a3a3,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x4d4d4d,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitGingerbread: defineOutfitSkin("outfitBase", {
        name: "Gingerbread",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-gingerbread.img",
            handTint: 0xd38136,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xdf2626,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitVenom: defineOutfitSkin("outfitBase", {
        name: "Venom",
        noDropOnDeath: true,

        rarity: 2,
        lore: "Created by CaptainPoultry",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-venom.img",
            handTint: 0x62cf3f,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x508831,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitEventHorizon: defineOutfitSkin("outfitBase", {
        name: "Event Horizon",
        noDropOnDeath: true,

        rarity: 4,
        lore: "Created by Roamer",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-event-horizon.img",
            handTint: 0x3b2586,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x100a26,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBlueMecha: defineOutfitSkin("outfitBase", {
        name: "Blue Mecha",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-blue-mecha.img",
            handTint: 0x2e2e2e,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xaaaaaa,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    // === Pass 6 ===
    outfitViper: defineOutfitSkin("outfitBase", {
        name: "Viper",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-viper.img",
            handTint: 0xa3a3a3,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x2aa0ba,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitUnderbrush: defineOutfitSkin("outfitBase", {
        name: "Underbrush",
        noDropOnDeath: true,

        rarity: 3,
        lore: "Created by Mxstyc",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-underbrush.img",
            handTint: 0x78a65a,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x78a65a,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitMellow: defineOutfitSkin("outfitBase", {
        name: "Mellow",
        noDropOnDeath: true,

        rarity: 3,
        lore: "Created by Jabari",

        skinImg: {
            baseTint: 0xedeb7f,
            baseSprite: "player-base-01.img",
            handTint: 0xedeb7f,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xc0ea7d,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitRosePetals: defineOutfitSkin("outfitBase", {
        name: "Rose Petals",
        noDropOnDeath: true,

        rarity: 1,
        lore: "Created by DotDot",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-rose-petals.img",
            handTint: 0x808080,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x808080,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBengal: defineOutfitSkin("outfitBase", {
        name: "Bengal",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-bengal.img",
            handTint: 0xea8611,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x101010,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSortaBlue: defineOutfitSkin("outfitBase", {
        name: "Sorta Blue",
        noDropOnDeath: true,

        rarity: 2,
        lore: "Created by StraightUpFoReal",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-sorta-blue.img",
            handTint: 0x0e1b2f,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-sorta-blue.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitPurpleMecha: defineOutfitSkin("outfitBase", {
        name: "Grape Mech",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-purple-mecha.img",
            handTint: 0x7f3a97,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x9bdd48,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitMagmatic: defineOutfitSkin("outfitBase", {
        name: "Magmatic",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-magmatic.img",
            handTint: 0xffffff,
            handSprite: "player-hands-magmatic.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-magmatic.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    // === Pass 7 ===
    outfitItJustMist: defineOutfitSkin("outfitBase", {
        name: "It Just Mist",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-it-just-mist.img",
            handTint: 0xaa0000,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xaa0000,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitOneInAMelon: defineOutfitSkin("outfitBase", {
        name: "One in a Melon",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0x24bf0c,
            baseSprite: "player-base-01.img",
            handTint: 0xffab1e,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xf74289,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBoet: defineOutfitSkin("outfitBase", {
        name: "Boet",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-boet.img",
            handTint: 0x183304,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x8b0c12,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitFullCircle: defineOutfitSkin("outfitBase", {
        name: "Full Circle",
        noDropOnDeath: true,

        rarity: 1,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-full-circle.img",
            handTint: 0x838495,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x171823,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitPanteraOnca: defineOutfitSkin("outfitBase", {
        name: "Pantera Onca",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-pantera-onca.img",
            handTint: 0xe39600,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xe39600,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitOldKumo: defineOutfitSkin("outfitBase", {
        name: "Old Kumo",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-old-kumo.img",
            handTint: 0x09432c,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x09432c,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitRetroSunset: defineOutfitSkin("outfitBase", {
        name: "Retro Sunset",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-retro-sunset.img",
            handTint: 0x222222,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x222222,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitPleasingPart: defineOutfitSkin("outfitBase", {
        name: "Pleasing Part",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-pleasing-part.img",
            handTint: 0xe65239,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xeece59,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitAvocadoh: defineOutfitSkin("outfitBase", {
        name: "Avocadoh",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-avocadoh.img",
            handTint: 0x9f672e,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x1c4723,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitTipTheScales: defineOutfitSkin("outfitBase", {
        name: "Tip the Scales",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-tip-the-scales.img",
            handTint: 0x4e6ba8,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x4e6ba8,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitEyes_t: defineOutfitSkin("outfitBase", {
        name: "Eyes-T",
        noDropOnDeath: false, // for now
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-eyes-t.img",
            handTint: 0xbfd4ec,
            handSprite: "player-hands-01.img",
            footTint: 0xbfd4ec,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffcfbb,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 5,
    }),
    // === Pass 8 ===
    outfitGhoulFire: defineOutfitSkin("outfitBase", {
        name: "Blue Burns",
        noDropOnDeath: true,

        rarity: 5,
        lore: "Created by earldre",

        skinImg: {
            baseTint: 0x117993,
            baseSprite: "player-base-01.img",
            handTint: 0xffffff,
            handSprite: "player-hands-ghoul-fire.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x13b3ff,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-ghoul-fire.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSunburn: defineOutfitSkin("outfitBase", {
        name: "Sunburn",
        noDropOnDeath: true,

        rarity: 1,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-sunburn.img",
            handTint: 0xffffff,
            handSprite: "player-hands-sunburn.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-sunburn.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitGridflag: defineOutfitSkin("outfitBase", {
        name: "Gridflag",
        noDropOnDeath: true,

        rarity: 2,
        lore: "Created by Saksham",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-gridflag.img",
            handTint: 0x1d93b8,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xb7aa3a,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitStarflag: defineOutfitSkin("outfitBase", {
        name: "Starflag",
        noDropOnDeath: true,

        rarity: 2,
        lore: "Created by Saksham",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-starflag.img",
            handTint: 0x9f1717,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x176089,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBubblegum: defineOutfitSkin("outfitBase", {
        name: "Bubblegum",
        noDropOnDeath: true,

        rarity: 1,
        lore: "Created by Thefatchicken",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-bubblegum.img",
            handTint: 0xffffff,
            handSprite: "player-hands-bubblegum.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-bubblegum.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitMelonWater: defineOutfitSkin("outfitBase", {
        name: "MelonWater",
        noDropOnDeath: true,

        rarity: 3,
        lore: "Created by Tyler I.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-melonwater.img",
            handTint: 0x8ab487,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x075300,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitElectricIce: defineOutfitSkin("outfitBase", {
        name: "Electric Ice",
        noDropOnDeath: true,

        rarity: 1,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-electric-ice.img",
            handTint: 0xffffff,
            handSprite: "player-hands-electric-ice.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-electric-ice.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitGaudisque: defineOutfitSkin("outfitBase", {
        name: "Gaudisque",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-gaudisque.img",
            handTint: 0xda6d5f,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x8b9661,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitToxicBarrel: defineOutfitSkin("outfitBase", {
        name: "Toxic Barrel",
        noDropOnDeath: true,

        rarity: 2,
        lore: "Created by gtFlamez",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-toxic-barrel.img",
            handTint: 0x405043,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x052600,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitStarryNight: defineOutfitSkin("outfitBase", {
        name: "Starry Night",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-starry-night.img",
            handTint: 0xffffff,
            handSprite: "player-hands-starry-night.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x1b2f55,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitHotMagma: defineOutfitSkin("outfitBase", {
        name: "Hot Magma",
        noDropOnDeath: true,

        rarity: 5,
        lore: "Created by XxHackerzxX",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-hot-magma.img",
            handTint: 0xffffff,
            handSprite: "player-hands-hot-magma.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-hot-magma.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBlueZone: defineOutfitSkin("outfitBase", {
        name: "Blue Zone",
        noDropOnDeath: true,

        rarity: 2,
        lore: "Created by JFKWhite",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-blue-zone.img",
            handTint: 0x202020,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xf0ff,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitKingGalaxy: defineOutfitSkin("outfitBase", {
        name: "King Galaxy",
        noDropOnDeath: true,

        rarity: 4,
        lore: "Created by AMBUSH",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-king-galaxy.img",
            handTint: 0xffffff,
            handSprite: "player-hands-king-galaxy.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-king-galaxy.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-king-galaxy.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitDragonTails: defineOutfitSkin("outfitBase", {
        name: "Dragon Tails",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 13041664,
            baseSprite: "player-base-dragon-tails.img",
            handTint: 0xffffff,
            handSprite: "player-hands-dragon-tails.img",
            footTint: 0xffffff,
            footSprite: "player-hands-dragon-tails.img",
            backpackTint: 7667712,
            backpackSprite: "player-circle-base-02.img",
            frontSpritePos: { x: -5, y: 0 },
            frontSprite: "player-accessory-dragon-tails.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
    }),
    outfitDigiturt: defineOutfitSkin("outfitBase", {
        name: "Digiturt",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-digiturt.img",
            handTint: 0x148262,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xe2cdaa,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBraaains: defineOutfitSkin("outfitBase", {
        name: "Braaains",
        noDropOnDeath: false, // for now
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-braaains.img",
            handTint: 0x5d6a85,
            handSprite: "player-hands-01.img",
            footTint: 0x686868,
            footSprite: "player-feet-01.img",
            backpackTint: 0x1386b8,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 5,
    }),
    outfitNorseCode: defineOutfitSkin("outfitBase", {
        name: "Norse Code",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-norse-code.img",
            handTint: 0x758078,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x682d07,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitILavaYou: defineOutfitSkin("outfitBase", {
        name: "I Lava You",
        noDropOnDeath: true,

        rarity: 4,
        lore: "Created by NeDmik",

        skinImg: {
            baseTint: 0x79002c,
            baseSprite: "player-base-01.img",
            handTint: 0xcf044d,
            handSprite: "player-hands-01.img",
            footTint: 0xcf044d,
            footSprite: "player-feet-01.img",
            backpackTint: 0xcf044d,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -2, y: 0 },
            frontSprite: "player-accessory-i-lava-you.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitJuleVerny: defineOutfitSkin("outfitBase", {
        name: "Jule Verny",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-jule-verny.img",
            handTint: 0xffffff,
            handSprite: "player-hands-jule-verny.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-jule-verny.img",
            frontSpritePos: { x: -6, y: 0 },
            frontSprite: "player-accessory-jule-verny.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitStumped: defineOutfitSkin("outfitBase", {
        name: "Stumped",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-stumped.img",
            handTint: 0xda9157,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x613721,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitStreetArt: defineOutfitSkin("outfitBase", {
        name: "Street Art",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-street-art.img",
            handTint: 0x212124,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x212124,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitCosmicBlue: defineOutfitSkin("outfitBase", {
        name: "Cosmic Blue",
        noDropOnDeath: false, // for now
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-cosmic-blue.img",
            handTint: 2755133,
            handSprite: "player-hands-02.img",
            footTint: 2755133,
            footSprite: "player-feet-02.img",
            backpackTint: 12002083,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 5,
    }),
    // === Pass 9 ===
    outfitColorPalette: defineOutfitSkin("outfitBase", {
        name: "Color Palette",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-color-palette.img",
            handTint: 0xaa6c23,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x871f34,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitChromaticCTR: defineOutfitSkin("outfitBase", {
        name: "Chromatic CTR",
        noDropOnDeath: true,

        rarity: 1,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-chromatic-ctr.img",
            handTint: 0x007878,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x00615b,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitTurtleSweater: defineOutfitSkin("outfitBase", {
        name: "Turtle Sweater",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-turtle-sweater.img",
            handTint: 0x007878,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x007878,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitHowPitaful: defineOutfitSkin("outfitBase", {
        name: "How Pita-ful",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-how-pita-ful.img",
            handTint: 0xffffff,
            handSprite: "player-hands-how-pita-ful.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x844514,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSoapPods: defineOutfitSkin("outfitBase", {
        name: "Soap Pods",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-soap-pods.img",
            handTint: 0x020058,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x020058,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitTomatoandCheese: defineOutfitSkin("outfitBase", {
        name: "Tomato and Cheese",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-tomato-and-cheese.img",
            handTint: 0x4b4b4b,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x4b4b4b,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitH2Oh: defineOutfitSkin("outfitBase", {
        name: "H2Oh!",
        noDropOnDeath: true,

        rarity: 5,
        lore: "Created by NeDmik",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-h2oh.img",
            handTint: 0xffffff,
            handSprite: "player-hands-h2oh.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-h2oh.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitScarween: defineOutfitSkin("outfitBase", {
        name: "Scarween",
        noDropOnDeath: true,

        rarity: 3,
        lore: "Created by IHASYOUPROS[YT]",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-scareween.img",
            handTint: 0xffffff,
            handSprite: "player-hands-scareween.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-scareween.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSwords: defineOutfitSkin("outfitBase", {
        name: "Swords",
        noDropOnDeath: true,

        rarity: 3,
        lore: "Created by skumzeninguem",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-swords.img",
            handTint: 0x156d6d,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x24b399,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitHopelessRamentic: defineOutfitSkin("outfitBase", {
        name: "Hopeless Ramen-tic",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-hopeless-ramentic.img",
            handTint: 0x292929,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x292929,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitChewieCheese: defineOutfitSkin("outfitBase", {
        name: "Chewie Cheese",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xbb2b10,
            baseSprite: "player-base-01.img",
            handTint: 0xecac5a,
            handSprite: "player-hands-01.img",
            footTint: 0xecac5a,
            footSprite: "player-feet-01.img",
            backpackTint: 0x7f493f,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-base-chewie-cheese.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 2,
        lore: "For those who wield the power of the pan.",
    }),
    // === Pass 10 ===
    outfitWoodFire: defineOutfitSkin("outfitBase", {
        name: "Wood Fire",
        noDropOnDeath: true,

        rarity: 1,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-wood-fire.img",
            handTint: 0xffffff,
            handSprite: "player-hands-wood-fire.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-wood-fire.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitHoldinHide: defineOutfitSkin("outfitBase", {
        name: "Holdin Hide",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-holdin-hide.img",
            handTint: 0xffffff,
            handSprite: "player-hands-holdin-hide.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x2d2617,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitDisasteroid: defineOutfitSkin("outfitBase", {
        name: "Disasteroid",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0x573c26,
            baseSprite: "player-base-01.img",
            handTint: 0xffffff,
            handSprite: "player-hands-disasteroid.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-disasteroid.img",
            frontSpritePos: { x: -10, y: -1.8 },
            frontSprite: "player-accessory-disasteroid.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBluntRazor: defineOutfitSkin("outfitBase", {
        name: "Blunt Razor",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-blunt-razor.img",
            handTint: 0xffffff,
            handSprite: "player-hands-blunt-razor.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-blunt-razor.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitRuppert: defineOutfitSkin("outfitBase", {
        name: "Ruppert",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-ruppert.img",
            handTint: 0xffffff,
            handSprite: "player-hands-ruppert.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x434759,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitGreenTeaRex: defineOutfitSkin("outfitBase", {
        name: "Green Tea Rex",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-green-tea-rex.img",
            handTint: 0xffffff,
            handSprite: "player-hands-green-tea-rex.img",
            footTint: 0x0a5551,
            footSprite: "player-feet-01.img",
            backpackTint: 0x0a5551,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 6, y: 0 },
            frontSprite: "player-accessory-green-tea-rex.img",
            aboveHand: true,
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
    }),
    outfitTribeMask: defineOutfitSkin("outfitBase", {
        name: "Tribe Mask",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-tribe-mask.img",
            handTint: 0xffd732,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x393839,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitPhoebonachi: defineOutfitSkin("outfitBase", {
        name: "phoebonachi",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-phoebonachi.img",
            handTint: 0xa53e35,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xd79e70,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitTribeShield: defineOutfitSkin("outfitBase", {
        name: "Tribe Shield",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-tribe-shield.img",
            handTint: 0x1fa3ab,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x5e2128,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitMultiTusking: defineOutfitSkin("outfitBase", {
        name: "Multi Tusking",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-multi-tusking.img",
            handTint: 0xa0683e,
            handSprite: "player-hands-01.img",
            footTint: 0xa0683e,
            footSprite: "player-feet-01.img",
            backpackTint: 0x42210c,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-multi-tusking.img",
            aboveHand: true,
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
    }),
    outfitTirelessly: defineOutfitSkin("outfitBase", {
        name: "Tirelessly",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-tirelessly.img",
            handTint: 0x404040,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x404040,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBrontoChop: defineOutfitSkin("outfitBase", {
        name: "Bronto Chop",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-bronto-chop.img",
            handTint: 0xcab39c,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xcab39c,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    // === Pass 11 ===
    outfitTunelSun: defineOutfitSkin("outfitBase", {
        name: "Tunel Sun",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-tunel-sun.img",
            handTint: 0xf52c95,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x15063d,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitHuedini: defineOutfitSkin("outfitBase", {
        name: "Hue-dini",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-huedini.img",
            handTint: 0x74eaf6,
            handSprite: "player-hands-01.img",
            footTint: 0x74eaf6,
            footSprite: "player-feet-01.img",
            backpackTint: 0xff76ff,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBombyman: defineOutfitSkin("outfitBase", {
        name: "Bombyman",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-bombyman.img",
            handTint: 0x3c3643,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x2f2934,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSunriseBlvd: defineOutfitSkin("outfitBase", {
        name: "Sunrise Blvd",
        noDropOnDeath: true,

        rarity: 1,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-sunrise-blvd.img",
            handTint: 0xff77c0,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x4d19e1,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitIdDie4U: defineOutfitSkin("outfitBase", {
        name: "Id Die 4 U",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0x640000,
            baseSprite: "player-base-01.img",
            handTint: 0xffd25d,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x420000,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -5, y: 0 },
            frontSprite: "player-accessory-id-die-4-u.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitIntoTheGrid: defineOutfitSkin("outfitBase", {
        name: "Into the Grid",
        noDropOnDeath: true,

        rarity: 1,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-into-the-grid.img",
            handTint: 0xce1c7d,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x210a45,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitToontooine: defineOutfitSkin("outfitBase", {
        name: "Toontooine",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-toontooine.img",
            handTint: 0x393a40,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x0f1014,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBitplosion: defineOutfitSkin("outfitBase", {
        name: "Bitplosion",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-bitplosion.img",
            handTint: 0xce2527,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffe500,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitItsMeCoin: defineOutfitSkin("outfitBase", {
        name: "It's-a-Coin", // name changed for better flow
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-its-me-coin.img",
            handTint: 0xffde52,
            handSprite: "player-hands-01.img",
            footTint: 0xffde52,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffde52,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 2,
        lore: "Shame it's just the regular yellow one...",
    }),
    outfitMaxAttack: defineOutfitSkin("outfitBase", {
        name: "Max Attack",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0x130f30,
            baseSprite: "player-base-01.img",
            handTint: 0xffffff,
            handSprite: "player-hands-max-attack.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x07003a,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-max-attack.img",
            aboveHand: true,
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
    }),
    // === Pass 12 ===
    outfitHowlODays: defineOutfitSkin("outfitBase", {
        name: "Howl-o-Days",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xf1e1d6,
            baseSprite: "player-base-01.img",
            handTint: 0xe1cec2,
            handSprite: "player-hands-01.img",
            footTint: 0xe1cec2,
            footSprite: "player-feet-01.img",
            backpackTint: 0xa6897e,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -10, y: 0 },
            frontSprite: "player-accessory-howl-o-days.img",
            aboveHand: true,
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 2,
        lore: "AWOOOOOOOOOOOOOOOOOOO",
    }),
    outfitCaptnCactus: defineOutfitSkin("outfitBase", {
        name: "Captn' Cactus",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-captn-cactus.img",
            handTint: 0xffffff,
            handSprite: "player-hands-captn-cactus.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x425501,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitNachoHat: defineOutfitSkin("outfitBase", {
        name: "Nacho Hat",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-nacho-hat.img",
            handTint: 0x9d664f,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x9d664f,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -10, y: 0 },
            frontSprite: "player-accessory-nacho-hat.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBroncoSaurus: defineOutfitSkin("outfitBase", {
        name: "Bronco-Saurus",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xdfc3aa,
            baseSprite: "player-base-01.img",
            handTint: 0x886d50,
            handSprite: "player-hands-01.img",
            footTint: 0x886d50,
            footSprite: "player-feet-01.img",
            backpackTint: 0x634b32,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -4, y: 0 },
            frontSprite: "player-accessory-bronco-saurus.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitNeckNapkin: defineOutfitSkin("outfitBase", {
        name: "Neck Napkin",
        noDropOnDeath: true,

        rarity: 1,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-neck-napkin.img",
            handTint: 0x724633,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x0b4071,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -11, y: 0 },
            frontSprite: "player-accessory-neck-napkin.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitMoosli: defineOutfitSkin("outfitBase", {
        name: "Moosli",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-moosli.img",
            handTint: 0xffffff,
            handSprite: "player-hands-moosli.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xf7f7f7,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 3, y: 0 },
            frontSprite: "player-accessory-moosli.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSuppaPoncho: defineOutfitSkin("outfitBase", {
        name: "Suppa Poncho",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-suppa-poncho.img",
            handTint: 0xffffff,
            handSprite: "player-hands-suppa-poncho.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x663f2e,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -11, y: 0 },
            frontSprite: "player-accessory-suppa-poncho.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitGoodFeather: defineOutfitSkin("outfitBase", {
        name: "Good Feather",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xc4765e,
            baseSprite: "player-base-01.img",
            handTint: 0xff8b3b,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x795e53,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -8, y: 0 },
            frontSprite: "player-accessory-good-feather.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitRanchDressing: defineOutfitSkin("outfitBase", {
        name: "Ranch Dressing",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-ranch-dressing.img",
            handTint: 0xd9a487,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x231204,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -4.3, y: -2 },
            frontSprite: "player-accessory-ranch-dressing.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitTheySeeMeRolling: defineOutfitSkin("outfitBase", {
        name: "They See Me Rolling",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0x6a3730,
            baseSprite: "player-base-01.img",
            handTint: 0xffd38c,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x481d17,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-they-see-me-rolling.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSirLoin: defineOutfitSkin("outfitBase", {
        name: "Sir Loin",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0x471a0b,
            baseSprite: "player-base-01.img",
            handTint: 0x471a0b,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x471a0b,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 3, y: 0 },
            frontSprite: "player-accessory-sir-loin.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    // === "NFTs" ===
    outfitAhoy: defineOutfitSkin("outfitBase", {
        name: "Captain Richpants",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-ahoy.img",
            handTint: 0xe9bf80,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-ahoy.img",
            frontSpritePos: { x: -9, y: 0 },
            frontSprite: "player-accessory-ahoy.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitLustrousPaladin: defineOutfitSkin("outfitBase", {
        name: "Palladius",
        moveEmitter: "paladinParticle",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-lustrous-paladin.img",
            handTint: 0xca0000,
            handSprite: "player-hands-01.img",
            footTint: 0xca0000,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-lustrous-paladin.img",
            frontSpritePos: { x: -1, y: 0 },
            frontSprite: "player-accessory-lustrous-paladin.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
    }),
    outfitVillageNinja: defineOutfitSkin("outfitBase", {
        name: "Nagato",
        noDropOnDeath: true,
        moveEmitter: "village_ninja_trail",
        skinImg: {
            baseTint: 0x040d1f,
            baseSprite: "player-base-01.img",
            handTint: 0x040d1f,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-village-ninja.img",
            frontSpritePos: { x: -2, y: 0 },
            frontSprite: "player-accessory-village-ninja.img",
            aboveHand: false,
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
    }),
    // === Other ===
    outfitYinYang: defineOutfitSkin("outfitBase", {
        name: "Yin Yang",
        noDropOnDeath: true,
        rarity: 3,
        lore: "Created by Spy",
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-yin-yang.img",
            handTint: 0xffffff,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x101010,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitTiki: defineOutfitSkin("outfitBase", {
        name: "Tiki",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-tiki.img",
            handTint: 0xce4452,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xdaa047,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitMachoLucha2: defineOutfitSkin("outfitBase", {
        name: "Macho Lucha",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-macho-lucha.img",
            handTint: 0xe3e190,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x393535,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitCalaca: defineOutfitSkin("outfitBase", {
        name: "Calaca",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-calaca.img",
            handTint: 0xf5901a,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x47c3b3,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    // === Unused ===
    outfitMecha: defineOutfitSkin("outfitBase", {
        name: "Mecha",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0xededed,
            baseSprite: "player-base-01.img",
            handTint: 0xffffff,
            handSprite: "player-hands-outfitMecha.img",
            footTint: 0x5b7eda,
            footSprite: "player-feet-01.img",
            backpackTint: 0x5b7eda,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-outfitMecha.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitDiamondy: defineOutfitSkin("outfitBase", {
        name: "Diamondy",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0xbfe8ff,
            baseSprite: "player-base-01.img",
            handTint: 0xf8c137,
            handSprite: "player-hands-01.img",
            footTint: 0xf8c137,
            footSprite: "player-feet-01.img",
            backpackTint: 0xf8c137,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-outfitDiamondy.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitEggnite: defineOutfitSkin("outfitBase", {
        name: "Eggnite",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-eggnite.img",
            handTint: 0xffd500,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x6e6e6e,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSpaceSnout: defineOutfitSkin("outfitBase", {
        name: "Space Snout",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-space-snout.img",
            handTint: 0xc1c1c1,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x084d40,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitMugnificent: defineOutfitSkin("outfitBase", {
        name: "Mugnificent",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-mugnificent.img",
            handTint: 0x356b7c,
            handSprite: "player-hands-01.img",
            footTint: 0x356b7c,
            footSprite: "player-feet-01.img",
            backpackTint: 0x1f4b59,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitDeRanged: defineOutfitSkin("outfitBase", {
        name: "De-Ranged",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xf4b592,
            baseSprite: "player-base-01.img",
            handTint: 0xf4b592,
            handSprite: "player-hands-01.img",
            footTint: 0xf4b592,
            footSprite: "player-feet-01.img",
            backpackTint: 0x1c1511,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -4.3, y: 0 },
            frontSprite: "player-accessory-de-ranged.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    // ============ SURVEV OUTFITS ============
    outfitSnow: defineOutfitSkin("outfitBase", {
        name: "Snowed Over",
        rarity: Rarity.Uncommon,
        lore: "It's shirt weather!!",
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitSnow.img",
            handTint: 0xffffff,
            handSprite: "player-hands-outfitSnow.img",
            footTint: 0xb2eaff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x77c4dd,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBlackIce: defineOutfitSkin("outfitBase", {
        name: "Black Ice",
        rarity: Rarity.Common,
        skinImg: {
            baseTint: 0x686d6e,
            baseSprite: "player-base-02.img",
            handTint: 0x414753,
            handSprite: "player-hands-01.img",
            footTint: 0x33333d,
            footSprite: "player-feet-01.img",
            backpackTint: 0x5e6473,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x5e6473,
        },
    }),
    outfitCoconut: defineOutfitSkin("outfitBase", {
        name: "Coconut Frenzy",
        rarity: Rarity.Common,
        lore: "It's the coco fruit!",
        skinImg: {
            baseTint: 0x765836,
            baseSprite: "player-base-01.img",
            handTint: 0x362d22,
            handSprite: "player-hands-01.img",
            footTint: 0xe9edf6,
            footSprite: "player-feet-01.img",
            backpackTint: 0xe9edf6,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x765836,
        },
    }),
    outfitWave: defineOutfitSkin("outfitBase", {
        name: "Tidal Wave",
        rarity: Rarity.Common,
        lore: "Send them to Davy Jones' locker.",
        skinImg: {
            baseTint: 0x1198ec,
            baseSprite: "player-base-02.img",
            handTint: 0xfdf5f1,
            handSprite: "player-hands-02.img",
            footTint: 0xfdf5f1,
            footSprite: "player-feet-02.img",
            backpackTint: 0x2178ae,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitParrotfish: defineOutfitSkin("outfitBase", {
        name: "Parrotfish",
        rarity: Rarity.Rare,
        lore: "Show off your scales around the island. Coral, beware!",
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitParrotfish.img",
            handTint: 0x3ac6c6,
            handSprite: "player-hands-02.img",
            footTint: 0x306790,
            footSprite: "player-feet-02.img",
            backpackTint: 0x37aeab,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    // ============ RESURVIV-ORIGINAL OUTFITS ============
    // === Base ===
    outfitKxrLogo: defineOutfitSkin("outfitBase", {
        name: "KxrClient's logo skin",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0x567042,
            baseSprite: "player-base-kxr.img",
            handTint: 0x6a8854,
            handSprite: "player-hands-01.img",
            footTint: 0x4a6038,
            footSprite: "player-feet-01.img",
            backpackTint: 0x62804c,
            backpackSprite: "player-circle-base-01.img",
            aboveHand: false,
        },
        lootImg: {
            skinLootImg: true,
            tint: 0x6a8854,
        },
        rarity: 3,
        lore: "For those who uses KxrClient :3",
    }),
    // === Passes ===
    outfitThePro: defineOutfitSkin("outfitBase", {
        name: "The Pro",
        noDropOnDeath: true,
        rarity: Rarity.Rare,
        lore: "For those who wear their wins.",
        skinImg: {
            baseTint: 0xedc078,
            baseSprite: "player-base-01.img",
            handTint: 0x325c62,
            handSprite: "player-hands-01.img",
            footTint: 0x325c62,
            footSprite: "player-feet-01.img",
            backpackTint: 0x274659,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitUrbanGlitch: defineOutfitSkin("outfitBase", {
        name: "Urban Glitch",
        noDropOnDeath: true,

        rarity: 2,
        lore: "For those who break the game.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-urban-glitch.img",
            aboveHand: true,
            handTint: 0x02fafa,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x3c3a3d,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitPython: defineOutfitSkin("outfitBase", {
        name: "Python",
        noDropOnDeath: true,
        rarity: 3,
        lore: "For those who blend seamlessly.",
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-python.img",
            handTint: 0x917f36,
            handSprite: "player-hands-01.img",
            footTint: 0xeeff5d,
            footSprite: "player-feet-01.img",
            backpackTint: 0x291e05,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitCyberpunk: defineOutfitSkin("outfitBase", {
        name: "Cyber Punk",
        noDropOnDeath: true,

        rarity: 3,
        lore: "For those who rule the digital network.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-cyberpunk.img",
            handTint: 0xffffff,
            handSprite: "player-hands-cyberpunk.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-cyberpunk.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitEnergyWave: defineOutfitSkin("outfitBase", {
        name: "Energy Wave",
        noDropOnDeath: true,

        rarity: 2,
        lore: "Created by catjo44.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-energy-wave.img",
            handTint: 0x0a2739,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x0a2739,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSolarAegis: defineOutfitSkin("outfitBase", {
        name: "Solar Aegis",
        noDropOnDeath: true,

        rarity: 3,
        lore: "To shine the way.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-solar-aegis.img",
            aboveHand: true,
            handTint: 0xffffff,
            handSprite: "player-hands-solar-aegis.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-solar-aegis.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitAuresis: defineOutfitSkin("outfitBase", {
        name: "Auresis",
        noDropOnDeath: true,

        rarity: 5,
        lore: "For those who turn everything they strike into pure gold.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-auresis.img",
            aboveHand: true,
            handTint: 0xffffff,
            handSprite: "player-hands-auresis.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-auresis.img",
            frontSpritePos: { x: -5, y: 0 },
            frontSprite: "player-accessory-auresis.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitIgris: defineOutfitSkin("outfitBase", {
        name: "Igris",
        noDropOnDeath: true,

        rarity: 5,
        lore: "For those who fight with absolute loyalty.",

        skinImg: {
            baseTint: 0xca212a,
            baseSprite: "player-base-01.img",
            handTint: 0xffffff,
            handSprite: "player-hands-igris.img",
            footTint: 0xca212a,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-igris.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-igris.img",
            aboveHand: true,
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitVoidcore: defineOutfitSkin("outfitBase", {
        name: "Void Core",
        noDropOnDeath: true,

        rarity: 2,
        lore: "For those who channel Ikou's cosmic energy.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-voidcore.img",
            handTint: 0xffffff,
            handSprite: "player-hands-voidcore.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-voidcore.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitArchaicCrown: defineOutfitSkin("outfitBase", {
        name: "Archaic Crown",
        noDropOnDeath: true,

        rarity: 5,
        lore: "For those who rule the server alongside Archaic.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-archaiccrown.img",
            handTint: 0xffffff,
            handSprite: "player-hands-archaiccrown.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-archaiccrown.img",
            frontSpritePos: { x: 0, y: -0.4 },
            frontSprite: "player-accessory-archaiccrown.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBee: defineOutfitSkin("outfitBase", {
        name: "Buzz Buzz",
        noDropOnDeath: true,

        rarity: 4,
        lore: "For those who sting and stay sweet.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-bee.img",
            handTint: 0xfec237,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-bee.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-bee.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitCupcake: defineOutfitSkin("outfitBase", {
        name: "Cupcake",
        noDropOnDeath: true,

        rarity: 5,
        lore: "Cupcake doesn't bite.",

        skinImg: {
            baseTint: 0xe2e2e8,
            aboveHand: true,
            baseSprite: "player-base-01.img",
            handTint: 0xabb3b3,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xabb3b3,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -0.75, y: 0 },
            frontSprite: "player-accessory-cupcake.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBeru: defineOutfitSkin("outfitBase", {
        name: "Beru",
        noDropOnDeath: true,

        rarity: 5,
        lore: "For those who serve the shadow king.",

        skinImg: {
            baseTint: 0x20f,
            baseSprite: "player-base-01.img",
            aboveHand: true,
            handTint: 0xffffff,
            handSprite: "player-hands-beru.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-beru.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-beru.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    // === Bundles ===
    outfitLivingGalaxy: defineOutfitSkin("outfitBase", {
        name: "Living Galaxy",
        noDropOnDeath: true,
        rarity: 5,
        lore: "A window into a sky that never stands still.",
        galaxyEffect: true,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-king-galaxy.img",
            handTint: 0xffffff,
            handSprite: "player-hands-king-galaxy.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-king-galaxy.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitCheckmate: defineOutfitSkin("outfitBase", {
        name: "Checkmate",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-checkmate.img",
            handTint: 0xeeeeee,
            handSprite: "player-hands-01.img",
            footTint: 0xeeeeee,
            footSprite: "player-hands-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-checkmate.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 2,
    }),
    outfitWolf: defineOutfitSkin("outfitBase", {
        name: "Wolf",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 6184542,
            baseSprite: "player-base-01.img",
            handTint: 9539985,
            handSprite: "player-hands-01.img",
            footTint: 9539985,
            footSprite: "player-hands-01.img",
            backpackTint: 5197647,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -3, y: 0 },
            frontSprite: "player-accessory-outfitWolf.img",
            aboveHand: true,
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 3,
        lore: "For those who hunt alone.",
    }),
    outfitRiotPlaid: defineOutfitSkin("outfitBase", {
        name: "Riot Plaid",
        noDropOnDeath: true,

        rarity: 3,
        lore: "For those who get spawn killed a lot.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-riot-plaid.img",
            aboveHand: true,
            handTint: 0xffffff,
            handSprite: "player-hands-riot-plaid.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-riot-plaid.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBugcat: defineOutfitSkin("outfitBase", {
        name: "Bugcat",
        noDropOnDeath: true,

        rarity: 4,
        lore: "For those who fight with pure cuteness.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-bugcat.img",
            handTint: 0x7dcaea,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-bugcat.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitGojo: defineOutfitSkin("outfitBase", {
        name: "Gojo",
        noDropOnDeath: true,

        rarity: 5,
        lore: "I alone am the honored one.",

        skinImg: {
            baseTint: 0xf9ca9d,
            baseSprite: "player-base-01.img",
            aboveHand: true,
            handTint: 0x24242b,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-gojo.img",
            frontSpritePos: { x: -1.95, y: -0.3702 },
            frontSprite: "player-accessory-gojo.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),

    outfitJinglyJester: defineOutfitSkin("outfitBase", {
        name: "Jingly Jester",
        noDropOnDeath: true,
        moveEmitter: "jesterParticle",

        rarity: 4,
        lore: "A Troller. ",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-jingly-jester.img",
            aboveHand: false,
            handTint: 0xffffff,
            handSprite: "player-hands-jingly-jester.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-jingly-jester.img",
            frontSpritePos: { x: -2.5, y: 0.18 },
            frontSprite: "player-accessory-jingly-jester.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitToxicChomper: defineOutfitSkin("outfitBase", {
        name: "Toxic Chomper",
        noDropOnDeath: true,
        rarity: 4,
        lore: "Created by Friend. ",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-toxic-chomper.img",
            aboveHand: false,
            handTint: 0xffffff,
            handSprite: "player-hands-toxic-chomper.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-toxic-chomper.img",
            frontSpritePos: { x: -1.0, y: -2.5 },
            frontSprite: "player-accessory-toxic-chomper.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitMahoraga: defineOutfitSkin("outfitBase", {
        name: "Mahoraga",
        noDropOnDeath: true,

        rarity: 5,
        lore: "With every turn, I adapt.",

        skinImg: {
            baseTint: 0xdcdbe3,
            baseSprite: "player-base-01.img",
            aboveHand: true,
            handTint: 0xd9d9e2,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x343741,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -3, y: -0.3702 },
            frontSprite: "player-accessory-mahoraga.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitToxicFire: defineOutfitSkin("outfitBase", {
        name: "Toxic Fire",
        noDropOnDeath: true,

        rarity: 5,
        lore: "For those who wield the green fire.",
        skinImg: {
            baseTint: 0x1f7816,
            baseSprite: "player-base-01.img",
            handTint: 0xffffff,
            handSprite: "player-hands-toxic-fire.img",
            footTint: 0xf8c137,
            footSprite: "player-feet-01.img",
            backpackTint: 0x4cd305,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-toxic-fire.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitCrimsonHibiscus: defineOutfitSkin("outfitBase", {
        name: "Crimson Hibiscus",
        noDropOnDeath: true,

        rarity: 3,
        lore: "For those who bloom with passion in the heat of battle.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-crimson-hibiscus.img",
            aboveHand: true,
            handTint: 0xa50035,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-crimson-hibiscus.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitDonut: defineOutfitSkin("outfitBase", {
        name: "Donut",
        noDropOnDeath: true,

        rarity: 3,
        lore: "For those who leave a trail of sweet defeat behind.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-donut.img",
            aboveHand: true,
            handTint: 0xf8c625,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-donut.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    // === Lootboxes ===
    outfitPolice: defineOutfitSkin("outfitBase", {
        name: "Police",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitPolice.img",
            handTint: 0xffffff,
            handSprite: "player-hands-police.img",
            footTint: 0xffffff,
            backpackTint: 0xffffff,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 5,
        lore: "For those who wield the power of the pan.",
    }),
    // === Clan season awards ===
    outfitTopOnePercent: defineOutfitSkin("outfitBase", {
        name: "Top 1%",
        noDropOnDeath: true,
        moveEmitter: "paladinParticle",
        lore: "Season 1 clan winner",
        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitSzn1-1stPlace.img",
            handTint: 0x1c1c1c,
            handSprite: "player-hands-01.img",
            footTint: 0x1c1c1c,
            footSprite: "player-feet-01.img",
            backpackTint: 0x1c1c1c,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -7, y: 0 },
            frontSprite: "player-accessory-outfitSzn1-1stPlace.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitTopTwoPercent: defineOutfitSkin("outfitBase", {
        name: "Top 2%",
        noDropOnDeath: true,
        moveEmitter: "silverParticle",
        lore: "Season 1 clan winner",
        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitSzn1-2ndPlace.img",
            handTint: 0x1c1c1c,
            handSprite: "player-hands-01.img",
            footTint: 0x1c1c1c,
            footSprite: "player-feet-01.img",
            backpackTint: 0x1c1c1c,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -7, y: 0 },
            frontSprite: "player-accessory-outfitSzn1-2ndPlace.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitTopThreePercent: defineOutfitSkin("outfitBase", {
        name: "Top 3%",
        noDropOnDeath: true,
        lore: "Season 1 clan winner",
        moveEmitter: "bronzeParticle",
        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitSzn1-3rdPlace.img",
            handTint: 0x1c1c1c,
            handSprite: "player-hands-01.img",
            footTint: 0x1c1c1c,
            footSprite: "player-feet-01.img",
            backpackTint: 0x1c1c1c,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -7, y: 0 },
            frontSprite: "player-accessory-outfitSzn1-3rdPlace.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSzn2: defineOutfitSkin("outfitBase", {
        name: "Season 2 Winner",
        noDropOnDeath: true,
        moveEmitter: "crownParticle",
        lore: "Season 2 Clan Champions — [#1] Clan",
        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitSzn2.img",
            handTint: 0xffffff,
            handSprite: "player-hands-outfitSzn2.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x1c1c1c,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -12.5, y: 0 },
            frontSprite: "player-accessory-outfitSzn2.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    // === Private ===
    outfitPreacher: defineOutfitSkin("outfitBase", {
        name: "Preacher",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 9586810,
            baseSprite: "player-base-02.img",
            handTint: 9586810,
            handSprite: "player-hands-02.img",
            footTint: 9586810,
            footSprite: "player-feet-02.img",
            backpackTint: 9586810,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 9586810,
        },
    }),
    outfitStepz: defineOutfitSkin("outfitBase", {
        name: "Stepz Outfit",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-stepz.img",
            handTint: 0x740007,
            handSprite: "player-hands-01.img",
            footTint: 0x740007,
            footSprite: "player-hands-01.img",
            backpackTint: 0x740007,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 3,
        lore: "Custom outfit for Stepz for winning tournament.",
    }),
    // === Unused? ===
    outfitPanda: defineOutfitSkin("outfitBase", {
        name: "Panda",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-01.img",
            handTint: 14408667,
            handSprite: "player-hands-01.img",
            footTint: 14408667,
            footSprite: "player-hands-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-outfitPanda.img",
            aboveHand: true,
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 3,
        lore: "",
    }),
    outfitDiamond: defineOutfitSkin("outfitBase", {
        name: "Diamond",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-diamond.img",
            handTint: 0xffffff,
            handSprite: "player-hands-diamond.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-diamond.img",
            frontSpritePos: { x: -5, y: 0 },
            frontSprite: "player-accessory-diamond.img",
            aboveHand: false,
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
        rarity: 5,
        lore: "For those who are retarded.",
    }),
    outfitAero: defineOutfitSkin("outfitBase", {
        name: "Aero",
        noDropOnDeath: true,

        rarity: 3,
        lore: "The Air.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-aero.img",
            handTint: 0x42566f,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x42566f,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitPtero: defineOutfitSkin("outfitBase", {
        name: "Ptero",
        noDropOnDeath: true,

        rarity: 3,
        lore: "The Flight.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-ptero.img",
            handTint: 0x48487a,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x302f57,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitHazard: defineOutfitSkin("outfitBase", {
        name: "Hazard",
        noDropOnDeath: true,

        rarity: 2,
        lore: "For those who serve as a walking warning label.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-hazard.img",
            handTint: 0xfff200,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xccc200,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitMummy: defineOutfitSkin("outfitBase", {
        name: "Mummy",
        noDropOnDeath: true,

        rarity: 4,
        lore: "For those who rise again after every loss.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-mummy.img",
            handTint: 0x98896e,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x98896e,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitColdestEdge: defineOutfitSkin("outfitBase", {
        name: "Coldest Edge",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-coldest-edge.img",
            handTint: 0x979797,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x202020,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitStickySituation: defineOutfitSkin("outfitBase", {
        name: "Stick-y Situation",
        noDropOnDeath: true,
        rarity: 3,
        lore: "Here to lumber the competition.",
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-stick-y-situation.img",
            handTint: 0xffffff,
            handSprite: "player-hands-stick-y-situation.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-stick-y-situation.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitPeru: defineOutfitSkin("outfitBase", {
        name: "Peru",
        noDropOnDeath: true,

        rarity: 2,
        lore: "For those who fight with Yoosepe.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-peru.img",
            handTint: 0xffffff,
            handSprite: "player-hands-peru.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xc1282d,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitPaintSplat: defineOutfitSkin("outfitBase", {
        name: "Paint Splat",
        noDropOnDeath: true,

        rarity: 3,
        lore: "For those who fight with a splash of color.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-paint-splat.img",
            aboveHand: true,
            handTint: 0x07e848,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x2b2d42,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSacredGeometry: defineOutfitSkin("outfitBase", {
        name: "Sacred Geometry",
        noDropOnDeath: true,

        rarity: 4,
        lore: "For those who see the hidden patterns in the battlefield.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-sacred-geometry.img",
            aboveHand: true,
            handTint: 0xffffff,
            handSprite: "player-hands-sacred-geometry.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-sacred-geometry.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitGoldenWaffle: defineOutfitSkin("outfitBase", {
        name: "Golden Waffle",
        noDropOnDeath: true,

        rarity: 3,
        lore: "For those who serve up sweet, golden destruction every morning.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-golden-waffle.img",
            aboveHand: true,
            handTint: 0xf5d469,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xbd7929,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitStoneIdol: defineOutfitSkin("outfitBase", {
        name: "Stone Idol",
        noDropOnDeath: true,

        rarity: 3,
        lore: "For those who command the power of the ancient stones.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-stone-idol.img",
            aboveHand: true,
            handTint: 0x62513b,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x786548,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitMissingTexture: defineOutfitSkin("outfitBase", {
        name: "Missing Texture",
        noDropOnDeath: true,

        rarity: 4,
        lore: "For those whose power renders the arena unrenderable.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-missing-texture.img",
            aboveHand: true,
            handTint: 0xff639a,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-missing-texture.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitAutumnSweater: defineOutfitSkin("outfitBase", {
        name: "Autumn Sweater",
        noDropOnDeath: true,

        rarity: 2,
        lore: "For those who stay warm when autumn chills the battlefield.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-autumn-sweater.img",
            aboveHand: true,
            handTint: 0xd35400,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x032320,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitCandy: defineOutfitSkin("outfitBase", {
        name: "Sweet Tooth",
        noDropOnDeath: true,

        rarity: 4,
        lore: "For those who kill with a sugar rush.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-candy.img",
            aboveHand: true,
            handTint: 0xffcc00,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x2880ee,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-candy.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitVikingHelm: defineOutfitSkin("outfitBase", {
        name: "Viking Helm",
        noDropOnDeath: true,

        rarity: 4,
        lore: "For those who fight with the spirit of the vikings.",

        skinImg: {
            baseTint: 0xd4a373,
            baseSprite: "player-base-01.img",
            handTint: 0x9a7a42,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x4a0e17,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-viking-helm.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitGhost: defineOutfitSkin("outfitBase", {
        name: "Ghost",
        noDropOnDeath: true,

        rarity: 4,
        lore: "For those who haunt the battlefield.",

        skinImg: {
            baseTint: 0xeec4a4,
            baseSprite: "player-base-01.img",
            handTint: 0xeec4a4,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xeec4a4,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -2, y: -1.8 },
            frontSprite: "player-accessory-ghost.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBullyGear: defineOutfitSkin("outfitBase", {
        name: "Bully Gear",
        noDropOnDeath: true,

        rarity: 3,
        lore: "If this skin served its original purpose, you’d die in roughly 20 seconds.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-bully-gear.img",
            handTint: 0x7d5d50,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x262626,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-bully-gear.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitGobble: defineOutfitSkin("outfitBase", {
        name: "Gobble",
        noDropOnDeath: true,

        rarity: 5,
        lore: "For those who gobble up the competition before feast day.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-gobble.img",
            aboveHand: true,
            handTint: 0x8b5a2b,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x4a2e18,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -2, y: 0 },
            frontSprite: "player-accessory-gobble.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitBlush: defineOutfitSkin("outfitBase", {
        name: "Blush",
        noDropOnDeath: true,

        rarity: 2,
        lore: "A little bit of blush to calm the quiet.",

        skinImg: {
            baseTint: 0xdcaeac,
            baseSprite: "player-base-01.img",
            aboveHand: true,
            handTint: 0xdcaeac,
            handSprite: "player-hands-01.img",
            footTint: 0xdcaeac,
            footSprite: "player-feet-01.img",
            backpackTint: 0xdcaeac,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitPie: defineOutfitSkin("outfitBase", {
        name: "Cherry Pie",
        noDropOnDeath: true,

        rarity: 3,
        lore: "For those who always serve up a slice of victory.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-pie.img",
            aboveHand: true,
            handTint: 0xda8c2e,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xba6c1b,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitMondrian: defineOutfitSkin("outfitBase", {
        name: "Mondrian Grid",
        noDropOnDeath: true,

        rarity: 3,
        lore: "For those who turn every battle into a masterpiece of modern art.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-mondrian.img",
            aboveHand: true,
            handTint: 0xe8ebe8,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-mondrian.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitLuna: defineOutfitSkin("outfitBase", {
        name: "Luna",
        noDropOnDeath: true,

        rarity: 3,
        lore: "Luna is the word for moon in Spanish.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-luna.img",
            aboveHand: true,
            handTint: 0x2f3246,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x2f3246,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitNightshadeStalker: defineOutfitSkin("outfitBase", {
        name: "Nightshade Stalker",
        noDropOnDeath: true,

        rarity: 3,
        lore: "For those who move silently in the shadows of the battlefield.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-nightshade-stalker.img",
            aboveHand: true,
            handTint: 0x2f2857,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x211b39,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitFishBowl: defineOutfitSkin("outfitBase", {
        name: "Fish Bowl",
        noDropOnDeath: true,

        rarity: 3,
        lore: "For those who swim in the sea of competition.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-fish-bowl.img",
            aboveHand: true,
            handTint: 0x79a9b7,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x79a9b7,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitAutumnForest: defineOutfitSkin("outfitBase", {
        name: "Autumn Forest",
        noDropOnDeath: true,

        rarity: 2,
        lore: "For those who blend seamlessly into the falling leaves.",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-autumn-forest.img",
            aboveHand: true,
            handTint: 0x4b1d13,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x4b1d13,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitPlaqueDoctor: defineOutfitSkin("outfitBase", {
        name: "Plague Doctor",
        noDropOnDeath: true,

        rarity: 5,
        lore: "The doctor of the plague.",

        skinImg: {
            baseTint: 0x2b2827,
            aboveHand: true,
            baseSprite: "player-base-01.img",
            handTint: 0x2b2827,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x2b2827,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 4, y: 0 },
            frontSprite: "player-accessory-plaque-doctor.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitForestPlaid: defineOutfitSkin("outfitBase", {
        name: "Forest Plaid",
        noDropOnDeath: true,

        rarity: 2,
        lore: "For those who chop through the competition like a true lumberjack.",

        skinImg: {
            baseTint: 0xffffff,
            aboveHand: true,
            baseSprite: "player-base-forest-plaid.img",
            handTint: 0x3b4433,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x1c1f1d,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitSpartan: defineOutfitSkin("outfitBase", {
        name: "Spartan",
        noDropOnDeath: true,

        rarity: 5,
        lore: "For those who fight with honor and valor under Archaic!",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-spartan.img",
            handTint: 0x4f3a75,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x4f3a75,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -2, y: 0.75 },
            frontSprite: "player-accessory-spartan.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitCatchemOl: defineOutfitSkin("outfitBase", {
        name: "Catchem Ol",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-catchem-ol.img",
            handTint: 0xffffff,
            handSprite: "player-hands-catchem-ol.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-catchem-ol.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitMeow: defineOutfitSkin("outfitBase", {
        name: "MEOW",
        noDropOnDeath: true,
        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-01.img",
            handTint: 0xffffff,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xf7f7f7,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-meow.img",
            aboveHand: true,
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitPreyDinner: defineOutfitSkin("outfitBase", {
        name: "Prey Dinner",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-prey-dinner.img",
            handTint: 0x815000,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0x2e1d0a,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitCandyCorn: defineOutfitSkin("outfitBase", {
        name: "Peru",
        noDropOnDeath: true,

        rarity: 2,
        lore: "For those who work with polarizing tastes.",

        skinImg: {
            baseTint: 0xff6b00,
            baseSprite: "player-base-01.img",
            handTint: 0xffd000,
            handSprite: "player-hands-01.img",
            footTint: 0xffd000,
            footSprite: "player-feet-01.img",
            backpackTint: 0xf4f4f4,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    // === Unfinished ===
    outfitVitaminD: defineOutfitSkin("outfitBase", {
        name: "Vitamin D",
        noDropOnDeath: true,
        rarity: 3,
        lore: "",
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitvitamnD.img",
            handTint: 0xffe600,
            handSprite: "player-fists-flaming-nucleus.img",
            footTint: 0xffe600,
            footSprite: "player-fists-flaming-nucleus.img",
            backpackTint: 0xffe600,
            frontSpritePos: { x: 0, y: -1 },
            frontSprite: "player-accessory-vitamin-d.img",
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
    outfitReTag: defineOutfitSkin("outfitBase", {
        name: "RSRV",
        noDropOnDeath: true,
        rarity: 5,
        lore: "Resurviv discord tag user",
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitvitamnD.img",
            handTint: 0xffffff,
            handSprite: "player-hands-starry-night.img",
            footTint: 0xffffff,
            footSprite: "player-hands-starry-night.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-rsrv-tag.img",
            frontSpritePos: { x: -2, y: 0 },
            frontSprite: "player-accessory-rsrv-tag.img",
            aboveHand: false,
        },
        lootImg: {
            skinLootImg: true,
            tint: 0xffffff,
        },
    }),
};

export const OutfitDefs = { ...BaseDefs, ...SkinDefs };
