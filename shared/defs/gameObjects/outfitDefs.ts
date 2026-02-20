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
            sprite: "loot-shirt-01.img",
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
    outfitBase: defineOutfitSkin("outfitBase", {
        noDropOnDeath: true,
        name: "Basic Outfit",
        rarity: Rarity.Stock,
        lore: "Pure and simple.",
        lootImg: {
            sprite: "loot-shirt-outfitBase.img",
            tint: 0xffffff,
        },
    }),
    outfitDemo: defineOutfitSkin("outfitBase", {
        noDrop: true,
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-outfitTurkey.img",
            tint: 0xf0cebb,
        },
        rarity: Rarity.Rare,
        lore: "M1100 not included.",
    }),
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
            sprite: "loot-shirt-outfitDev.img",
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
            sprite: "loot-shirt-outfitGD.img",
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
            sprite: "loot-shirt-outfitMod.img",
            tint: 0xffffff,
        },
        rarity: Rarity.Epic,
        lore: "For those who wield the power of the pan.",
    }),
    outfitGrich: defineOutfitSkin("outfitBase", {
        name: "Grinch",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-grinch.img",
            handTint: 0xffffff,
            handSprite: "player-hands-grinch.img",
            footTint: 0xffffff,
            footSprite: "player-hands-grinch.img",
            backpackTint: 12002083,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            sprite: "loot-shirt-grinch.img",
            tint: 0xffffff,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
    }),
    outfitEyes_t: defineOutfitSkin("outfitBase", {
        name: "Eyes-T",
        noDropOnDeath: false, // for now
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-eyes-t.img",
            handTint: 16777215,
            handSprite: "player-hands-01.img",
            footTint: 16777215,
            footSprite: "player-feet-01.img",
            backpackTint: 16777215,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            sprite: "loot-eyes-t-outfit.img",
            tint: 0xffffff,
        },
        rarity: 5,
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
            sprite: "loot-cosmic-blue-outfit.img",
            tint: 0xffffff,
        },
        rarity: 5,
    }),
    outfitBraaains: defineOutfitSkin("outfitBase", {
        name: "Braaains",
        noDropOnDeath: false, // for now
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-braaains.img",
            handTint: 6842472,
            handSprite: "player-hands-01.img",
            footTint: 6842472,
            footSprite: "player-feet-01.img",
            backpackTint: 65535,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            sprite: "loot-braaains-outfit.img",
            tint: 0xffffff,
        },
        rarity: 5,
    }),
    outfitSnowman: defineOutfitSkin("outfitBase", {
        name: "Snowman",
        noDropOnDeath: true,
        rarity: 4,
        lore: "",
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-snowman.img",
            handTint: 0xc02727,
            handSprite: "player-hands-01.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xc02727,
            frontSpritePos: { x: 3, y: 0 },
            frontSprite: "player-accessory-snowman.img",
        },
        lootImg: {
            sprite: "loot-snowman-outfit.img",
            tint: 0xffffff,
        },
    }),
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
            sprite: "loot-kxr-outfit.img",
            tint: 0x6a8854,
        },
        rarity: 3,
        lore: "For those who uses KxrClient :3",
    }),
    outfitPolice: defineOutfitSkin("outfitBase", {
        name: "Police",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitPolice.img",
            handTint: 0xffffff,
            handSprite: "player-fists-police.img",
            footTint: 0xffffff,
            backpackTint: 0xffffff,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            sprite: "loot-Police.img",
            tint: 0xffffff,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
    }),

    outfitChewieCheese: defineOutfitSkin("outfitBase", {
        name: "Chewie Cheese",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 12266256,
            baseSprite: "player-base-01.img",
            handTint: 0xf8c574,
            handSprite: "player-hands-01.img",
            footTint: 0xf8c574,
            footSprite: "player-hands-01.img",
            backpackTint: 13644309,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-base-chewie-cheese.img",
        },
        lootImg: {
            sprite: "loot-chewie-cheese-outfit.img",
            tint: 0xffffff,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
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
            sprite: "loot-stepz-outfit.img",
            tint: 0xffffff,
        },
        rarity: 3,
        lore: "Custom outfit for Stepz for winning tournament.",
    }),
    outfitThePro: defineOutfitSkin("outfitBase", {
        name: "The Pro",
        noDropOnDeath: true,
        rarity: Rarity.Rare,
        lore: "For those who wear their wins",
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
            sprite: "loot-shirt-outfitThePro.img",
            tint: 0xffffff,
        },
    }),
    outfitChemisTree: defineOutfitSkin("outfitBase", {
        name: "Chemis-tree",
        noDropOnDeath: true,
        rarity: 3,
        lore: "",
        skinImg: {
            baseTint: 16777215,
            baseSprite: "player-base-chemis-tree.img",
            handTint: 16777215,
            handSprite: "player-hands-chemis-tree.img",
            footTint: 16777215,
            footSprite: "player-feet-01.img",
            backpackTint: 0x274659,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            sprite: "loot-chemis-tree-outfit.img",
            tint: 0xffffff,
        },
    }),
    outfitWinter: defineOutfitSkin("outfitBase", {
        name: "Winter Onesie",
        noDropOnDeath: true,
        rarity: 3,
        lore: "Sleep Well.",
        skinImg: {
            baseTint: 16777215,
            baseSprite: "player-base-outfitWinter.img",
            handTint: 16777215,
            handSprite: "player-hands-winter.img",
            footTint: 4168127,
            footSprite: "player-feet-02.img",
            backpackTint: 4032425,
            backpackSprite: "player-circle-base-02.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitWinter.img",
            tint: 0xffffff,
        },
    }),

    outfitFireball: defineOutfitSkin("outfitBase", {
        name: "Fireball",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 12266256,
            baseSprite: "player-base-01.img",
            handTint: 0xffffff,
            handSprite: "player-hands-outfitFireball.img",
            footTint: 0xffffff,
            footSprite: "player-hands-outfitFireball.img",
            backpackTint: 13644309,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -4, y: 0 },
            frontSprite: "player-accessory-outfitFireball.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitFireball.img",
            tint: 0xffffff,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
    }),
    outfitGreenTeaRex: defineOutfitSkin("outfitBase", {
        name: "Green Tea Rex",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 16777215,
            baseSprite: "player-base-green-tea-rex.img",
            handTint: 0xffffff,
            handSprite: "player-hands-green-tea-rex.img",
            footTint: 0xffffff,
            footSprite: "player-hands-green-tea-rex.img",
            backpackTint: 13644309,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 6, y: 0 },
            frontSprite: "player-accessory-green-tea-rex.img",
            aboveHand: true,
        },
        lootImg: {
            sprite: "loot-green-tea-rex-outfit.img",
            tint: 0xffffff,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
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
            sprite: "loot-dragon-tails-outfit.img",
            tint: 0xffffff,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
    }),
    outfitVillageNinja: defineOutfitSkin("outfitBase", {
        name: "Village Ninja",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 16777215,
            baseSprite: "player-base-village-ninja.img",
            handTint: 0xffffff,
            handSprite: "player-hands-village-ninja.img",
            footTint: 0xffffff,
            footSprite: "player-hands-dragon-tails.img",
            backpackTint: 16777215,
            backpackSprite: "player-back-village-ninja.img",
            frontSpritePos: { x: -2, y: 0 },
            frontSprite: "player-accessory-village-ninja.img",
            aboveHand: false,
        },
        lootImg: {
            sprite: "loot-village-ninja-outfit.img",
            tint: 16777215,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
    }),
    outfitChromesis: defineOutfitSkin("outfitBase", {
        name: "Chromesis",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 16777215,
            baseSprite: "player-base-outfitChromesis.img",
            handTint: 0xffffff,
            handSprite: "player-hands-chrome.img",
            footTint: 0xffffff,
            footSprite: "player-hands-chrome.img",
            backpackTint: 9803157,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -5, y: 0 },
            frontSprite: "outfit-chrome-accessory.img",
            aboveHand: false,
        },
        lootImg: {
            sprite: "loot-shirt-outfitChromesis.img",
            tint: 16777215,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
    }),
    outfitMultiTusking: defineOutfitSkin("outfitBase", {
        name: "Multi Tusking",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 16777215,
            baseSprite: "player-base-multi-tusking.img",
            handTint: 0xffffff,
            handSprite: "player-hands-multi-tusking.img",
            footTint: 0xffffff,
            footSprite: "player-hands-multi-tusking.img",
            backpackTint: 9065728,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-multi-tusking.img",
            aboveHand: true,
        },
        lootImg: {
            sprite: "loot-multi-tusking-outfit.img",
            tint: 16777215,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
    }),
    outfitMaxAttack: defineOutfitSkin("outfitBase", {
        name: "Max Attack",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 16777215,
            baseSprite: "player-base-max-attack.img",
            handTint: 0xffffff,
            handSprite: "player-hands-max-attack.img",
            footTint: 0xffffff,
            footSprite: "player-hands-max-attack.img",
            backpackTint: 2359872,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-max-attack.img",
            aboveHand: true,
        },
        lootImg: {
            sprite: "loot-max-attack-outfit.img",
            tint: 16777215,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
    }),
    outfitLustrousPaladin: defineOutfitSkin("outfitBase", {
        name: "Lustrous Paladin",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 16777215,
            baseSprite: "player-base-lustrous-paladin.img",
            handTint: 0xffffff,
            handSprite: "player-hands-lustrous-paladin.img",
            footTint: 0xffffff,
            footSprite: "player-hands-lustrous-paladin.img",
            backpackTint: 16768256,
            backpackSprite: "player-circle-base-01.img",
            frontSpritePos: { x: -1, y: 0 },
            frontSprite: "player-accessory-lustrous-paladin.img",
        },
        lootImg: {
            sprite: "loot-lustrous-paladin-outfit.img",
            tint: 16777215,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
    }),

    outfitSpeedoSunburn: defineOutfitSkin("outfitBase", {
        name: "Speedo Sunburn",
        noDropOnDeath: true,
        skinImg: {
            baseTint: 16777215,
            baseSprite: "player-base-outfitSpeedoSunburn.img",
            handTint: 16037119,
            handSprite: "player-hands-01.img",
            footTint: 16037119,
            footSprite: "player-feet-01.img",
            backpackTint: 16650006,
            backpackSprite: "player-circle-base-01.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitSpeedoSunburn.img",
            tint: 16777215,
        },
        rarity: 3,
        lore: "For those who wield the power of the pan.",
    }),

    outfitWheat: defineOutfitSkin("outfitBase", {
        name: "Splintered Wheat",
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
            sprite: "loot-shirt-outfitWheat.img",
            tint: 0xffffff,
        },
    }),
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
            sprite: "loot-shirt-01.img",
            tint: 9586810,
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-outfitSpetsnaz.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-outfitLumber.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-outfitHeaven.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
            tint: 0xc3ae85,
        },
    }),
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
            sprite: "loot-shirt-outfitParma.img",
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
            sprite: "loot-shirt-outfitParmaPrestige.img",
            tint: 0xffffff,
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-outfitWoodland.img",
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
            sprite: "loot-shirt-outfitRoyalFortune.img",
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
            sprite: "loot-shirt-outfitKeyLime.img",
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
            sprite: "loot-shirt-outfitCobaltShell.img",
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
            sprite: "loot-shirt-01.img",
            tint: 0x938632,
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
            sprite: "loot-shirt-outfitCarbonFiber.img",
            tint: 0xffffff,
        },
    }),
    outfitDarkGloves: defineOutfitSkin("outfitBase", {
        name: "The Professional",
        // noDropOnDeath: true,
        rarity: Rarity.Uncommon,
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
            sprite: "loot-shirt-outfitDarkGloves.img",
            tint: 0xffffff,
        },
    }),
    outfitDarkShirt: defineOutfitSkin("outfitBase", {
        name: "The Semi-Pro",
        noDropOnDeath: true,
        rarity: Rarity.Common,
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
            sprite: "loot-shirt-outfitDarkShirt.img",
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
            sprite: "loot-shirt-01.img",
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
            sprite: "loot-shirt-outfitDesertCamo.img",
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
            sprite: "loot-shirt-outfitCamo.img",
            tint: 0xffffff,
        },
    }),
    outfitRed: defineOutfitSkin("outfitBase", {
        name: "Target Practice",
        // noDropOnDeath: true,
        rarity: Rarity.Common,
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
            sprite: "loot-shirt-outfitRed.img",
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
            sprite: "loot-shirt-outfitWhite.img",
            tint: 0xffffff,
        },
    }),
    outfitBarrel: defineOutfitSkin("outfitBase", {
        name: "Barrel Costume",
        obstacleType: "barrel_01",
        baseScale: 0.8,
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

    // ============ GENERATED OUTFITS ============
    outfitWhiteDay: defineOutfitSkin("outfitBase", {
        name: "Marshmallow Suit",
        rarity: 0,
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
            sprite: "loot-shirt-whiteDay.img",
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
            sprite: "loot-shirt-outfitGeometric.img",
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
            backpackTint: 0xffffff,
            backpackSprite: "player-back-military.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitMilitary.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-sunset.img",
            footTint: 0xbe89ab,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-sunset.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitSunset.img",
            tint: 0xffffff,
        },
    }),

    outfitDeepPurple: defineOutfitSkin("outfitBase", {
        name: "Deep Purple",
        noDropOnDeath: true,

        rarity: 1,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitDeepPurple.img",
            handTint: 0xffffff,
            handSprite: "player-hands-deep-purple.img",
            footTint: 0x907b9e,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-deep-purple.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitDeepPurple.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-splotchfest.img",
            footTint: 0x63a73c,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-splotchfest.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitSplotchfest.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-clay-more.img",
            footTint: 0xa8502a,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-clay-more.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitClayMore.img",
            tint: 0xffffff,
        },
    }),

    outfitRusticSands: defineOutfitSkin("outfitBase", {
        name: "Rustic Sands",
        noDropOnDeath: true,

        rarity: 1,
        lore: "Created by FrankzeeTank",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-rustic-sands.img",
            handTint: 0xffffff,
            handSprite: "player-hands-rustic-sands.img",
            footTint: 0x714216,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-rustic-sands.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitRusticSands.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-waves.img",
            footTint: 0x3c7598,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-waves.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitWaves.img",
            tint: 0xffffff,
        },
    }),

    outfitUrbanCamo: defineOutfitSkin("outfitBase", {
        name: "Urban Camo",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitUrbanCamo.img",
            handTint: 0xffffff,
            handSprite: "player-hands-urban-camo.img",
            footTint: 0x2b405c,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-urban-camo.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitUrbanCamo.img",
            tint: 0xffffff,
        },
    }),

    outfitNeonEyesore: defineOutfitSkin("outfitBase", {
        name: "Neon Eyesore",
        noDropOnDeath: true,

        rarity: 3,
        lore: "Created by Savage_Wuhan (Jerrie123)",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-neon.img",
            handTint: 0xffffff,
            handSprite: "player-hands-neon.img",
            footTint: 0x75fa4c,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-neon.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitNeonEyesore.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-giraffe.img",
            footTint: 0xf1b644,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-giraffe.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitGiraffe.img",
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
            handSprite: "player-hands-cow.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-cow.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitCow.img",
            tint: 0xffffff,
        },
    }),

    outfitMojo: defineOutfitSkin("outfitBase", {
        name: "Mojo",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitMojo.img",
            handTint: 0x0fffff,
            handSprite: "player-hands-mojo.img",
            footTint: 0xe6c70d,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-mojo.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitMojo.img",
            tint: 0xffffff,
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
            handSprite: "player-hands-zebra.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-zebra.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitZebra.img",
            tint: 0xffffff,
        },
    }),

    outfitAstronaut: defineOutfitSkin("outfitBase", {
        name: "Astronaut",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-astronaut.img",
            handTint: 0xffffff,
            handSprite: "player-hands-astronaut.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-astronaut.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-outfitAstronaut.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitAstronaut.img",
            tint: 0xffffff,
        },
    }),

    outfitDiamondy: defineOutfitSkin("outfitBase", {
        name: "Diamondy",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-diamondy.img",
            handTint: 0xffffff,
            handSprite: "player-hands-diamondy.img",
            footTint: 0xf8c137,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-diamondy.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-outfitDiamondy.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitDiamondy.img",
            tint: 0xffffff,
        },
    }),

    outfitMecha: defineOutfitSkin("outfitBase", {
        name: "Mecha",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-mecha.img",
            handTint: 0xffffff,
            handSprite: "player-hands-outfitMecha.img",
            footTint: 0x5b7eda,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-mecha.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-outfitMecha.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitMecha.img",
            tint: 0xffffff,
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

    outfitSpeedo: defineOutfitSkin("outfitBase", {
        name: "Speedo",
        rarity: 1,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitSpeedo.img",
            handTint: 0xffffff,
            handSprite: "player-hands-speedo.img",
            footTint: 0x959595,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-speedo.img",
        },
        lootImg: {
            sprite: "loot-shirt-speedo.img",
            tint: 0xffffff,
        },
    }),

    outfitBlueLava: defineOutfitSkin("outfitBase", {
        name: "BlueLava",
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
            backpackSprite: "player-circle-base-outfitBlueLava.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitBlueLava.img",
            tint: 0xffffff,
        },
    }),

    outfitInfernoCamo: defineOutfitSkin("outfitBase", {
        name: "Inferno Camo",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-outfitInferno.img",
            handTint: 0xffffff,
            handSprite: "player-hands-magma-camo.img",
            footTint: 0xe85f0a,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-magma-camo.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitInferno.img",
            tint: 0xffffff,
        },
    }),

    outfitMango: defineOutfitSkin("outfitBase", {
        name: "Mango",
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
            backpackTint: 0xffffff,
            backpackSprite: "player-back-smoothie.img",
        },
        lootImg: {
            sprite: "loot-shirt-outfitMango.img",
            tint: 0xffffff,
        },
    }),

    outfitParrot: defineOutfitSkin("outfitBase", {
        name: "Parrot",
        noDropOnDeath: true,

        rarity: 1,
        lore: "Created by Mxstyc",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-parrot.img",
            handTint: 0xffffff,
            handSprite: "player-hands-parrot.img",
            footTint: 0xeac352,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-parrot.img",
        },
        lootImg: {
            sprite: "loot-shirt-parrot.img",
            tint: 0xffffff,
        },
    }),

    outfitCrusader: defineOutfitSkin("outfitBase", {
        name: "Crusader",
        noDropOnDeath: true,

        rarity: 2,
        lore: "Created by avika",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-crusader.img",
            handTint: 0xffffff,
            handSprite: "player-hands-crusader.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-crusader.img",
        },
        lootImg: {
            sprite: "loot-crusader-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-lasr-disk.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-lasr-disk.img",
        },
        lootImg: {
            sprite: "loot-lasr-disk-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-beach-camo.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-beach-camo.img",
        },
        lootImg: {
            sprite: "loot-beach-camo-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-forest.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-forest.img",
        },
        lootImg: {
            sprite: "loot-forest-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-gingerbread.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-gingerbread.img",
        },
        lootImg: {
            sprite: "loot-gingerbread-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-venom.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-venom.img",
        },
        lootImg: {
            sprite: "loot-venom-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-blue-mecha.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-blue-mecha.img",
        },
        lootImg: {
            sprite: "loot-blue-mecha-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-event-horizon.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-event-horizon.img",
        },
        lootImg: {
            sprite: "loot-event-horizon-outfit.img",
            tint: 0xffffff,
        },
    }),
    outfitChritstmasTree: defineOutfitSkin("outfitBase", {
        name: "Chritstmas Tree",
        noDropOnDeath: true,
        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-christmastree.img",
            handTint: 0xffffff,
            handSprite: "player-hands-christmastree.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-christmas-tree.img",
        },
        lootImg: {
            sprite: "loot-shirt-christmastree.img",
            tint: 0xffffff,
        },
    }),

    outfitYinYang: defineOutfitSkin("outfitBase", {
        name: "Yin Yang",
        noDropOnDeath: true,
        rarity: 3,
        lore: "Created by Spy",
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-yin-yang.img",
            handTint: 0xffffff,
            handSprite: "player-hands-yin-yang.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-yin-yang.img",
        },
        lootImg: {
            sprite: "loot-yin-yang-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-tiki.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-tiki.img",
        },
        lootImg: {
            sprite: "loot-tiki-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-macho-lucha.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "macho-lucha-back.img",
        },
        lootImg: {
            sprite: "loot-macho-lucha-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-calaca.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-calaca.img",
        },
        lootImg: {
            sprite: "loot-shirt-calaca.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-sorta-blue.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-sorta-blue.img",
        },
        lootImg: {
            sprite: "loot-sorta-blue-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitMellow: defineOutfitSkin("outfitBase", {
        name: "Mellow",
        noDropOnDeath: true,

        rarity: 3,
        lore: "Created by Jabari",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-mellow.img",
            handTint: 0xffffff,
            handSprite: "player-hands-mellow.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-mellow.img",
        },
        lootImg: {
            sprite: "loot-mellow-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-bengal.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-bengal.img",
        },
        lootImg: {
            sprite: "loot-bengal-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-underbrush.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-underbrush.img",
        },
        lootImg: {
            sprite: "loot-underbrush-outfit.img",
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
            sprite: "loot-magmatic-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitPurpleMecha: defineOutfitSkin("outfitBase", {
        name: "Purple Mecha",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-purple-mecha.img",
            handTint: 0xffffff,
            handSprite: "player-hands-purple-mecha.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-purple-mecha.img",
        },
        lootImg: {
            sprite: "loot-purple-mecha-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-rose-petals.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-rose-petals.img",
        },
        lootImg: {
            sprite: "loot-rose-petals-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitViper: defineOutfitSkin("outfitBase", {
        name: "Viper",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-viper.img",
            handTint: 0xffffff,
            handSprite: "player-hands-viper.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-viper.img",
        },
        lootImg: {
            sprite: "loot-viper-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-full-circle.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-full-circle.img",
        },
        lootImg: {
            sprite: "loot-full-circle-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-pleasing-part.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-pleasing-part.img",
        },
        lootImg: {
            sprite: "loot-pleasing-part-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitItJustMist: defineOutfitSkin("outfitBase", {
        name: "It Just Mist",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-it-just-mist.img",
            handTint: 0xffffff,
            handSprite: "player-hands-it-just-mist.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-it-just-mist.img",
        },
        lootImg: {
            sprite: "loot-it-just-mist-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitOneInAMelon: defineOutfitSkin("outfitBase", {
        name: "One In A Melon",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-one-in-a-melon.img",
            handTint: 0xffffff,
            handSprite: "player-hands-one-in-a-melon.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-one-in-a-melon.img",
        },
        lootImg: {
            sprite: "loot-one-in-a-melon-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-coldest-edge.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-coldest-edge.img",
        },
        lootImg: {
            sprite: "loot-coldest-edge-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-retro-sunset.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-retro-sunset.img",
        },
        lootImg: {
            sprite: "loot-retro-sunset-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-boet.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-boet.img",
        },
        lootImg: {
            sprite: "loot-boet-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-old-kumo.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-old-kumo.img",
        },
        lootImg: {
            sprite: "loot-old-kumo-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-pantera-onca.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-pantera-onca.img",
        },
        lootImg: {
            sprite: "loot-pantera-onca-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitTipTheScales: defineOutfitSkin("outfitBase", {
        name: "Tip The Scales",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-tip-the-scales.img",
            handTint: 0xffffff,
            handSprite: "player-hands-tip-the-scales.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-tip-the-scales.img",
        },
        lootImg: {
            sprite: "loot-tip-the-scales-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-avocadoh.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-avocadoh.img",
        },
        lootImg: {
            sprite: "loot-avocadoh-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-eggnite.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-eggnite.img",
        },
        lootImg: {
            sprite: "loot-eggnite-outfit.img",
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
            sprite: "loot-sunburn-outfit.img",
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
            sprite: "loot-electric-ice-outfit.img",
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
            sprite: "loot-bubblegum-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-gaudisque.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-gaudisque.img",
        },
        lootImg: {
            sprite: "loot-gaudisque-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-starflag.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-starflag.img",
        },
        lootImg: {
            sprite: "loot-starflag-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-gridflag.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-gridflag.img",
        },
        lootImg: {
            sprite: "loot-gridflag-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-toxic-barrel.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-toxic-barrel.img",
        },
        lootImg: {
            sprite: "loot-toxic-barrel-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-blue-zone.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-blue-zone.img",
        },
        lootImg: {
            sprite: "loot-blue-zone-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitStumpd: defineOutfitSkin("outfitBase", {
        name: "Stumpd",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-stumpd.img",
            handTint: 0xffffff,
            handSprite: "player-hands-stumpd.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-stumpd.img",
        },
        lootImg: {
            sprite: "loot-stumpd-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitDigiturt: defineOutfitSkin("outfitBase", {
        name: "Digiturt",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-digiturt.img",
            handTint: 0xffffff,
            handSprite: "player-hands-digiturt.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-digiturt.img",
        },
        lootImg: {
            sprite: "loot-digiturt-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-melonwater.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-melonwater.img",
        },
        lootImg: {
            sprite: "loot-melonwater-outfit.img",
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
            backpackTint: 0xffffff,
            backpackSprite: "player-back-starry-night.img",
        },
        lootImg: {
            sprite: "loot-starry-night-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-street-art.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-street-art.img",
        },
        lootImg: {
            sprite: "loot-street-art-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitNorseCode: defineOutfitSkin("outfitBase", {
        name: "Norse Code",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-norse-code.img",
            handTint: 0xffffff,
            handSprite: "player-hands-norse-code.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-norse-code.img",
        },
        lootImg: {
            sprite: "loot-norse-code-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitILavaYou: defineOutfitSkin("outfitBase", {
        name: "I Lava You",
        noDropOnDeath: true,

        rarity: 4,
        lore: "Created by NeDmik",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-i-lava-you.img",
            handTint: 0xffffff,
            handSprite: "player-hands-i-lava-you.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-i-lava-you.img",
            frontSpritePos: { x: -2, y: 0 },
            frontSprite: "player-accessory-i-lava-you.img",
        },
        lootImg: {
            sprite: "loot-i-lava-you-outfit.img",
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
            sprite: "loot-king-galaxy-outfit.img",
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
            sprite: "loot-jule-verny-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitGhoulFire: defineOutfitSkin("outfitBase", {
        name: "Blue Burns",
        noDropOnDeath: true,

        rarity: 5,
        lore: "Created by earldre",

        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-ghoul-fire.img",
            handTint: 0xffffff,
            handSprite: "player-hands-ghoul-fire.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-ghoul-fire.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-ghoul-fire.img",
        },
        lootImg: {
            sprite: "loot-ghoul-fire-outfit.img",
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
            sprite: "loot-hot-magma-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitAhoy: defineOutfitSkin("outfitBase", {
        name: "Ahoy",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-ahoy.img",
            handTint: 0xffffff,
            handSprite: "player-hands-ahoy.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-ahoy.img",
            frontSpritePos: { x: -9, y: 0 },
            frontSprite: "player-accessory-ahoy.img",
        },
        lootImg: {
            sprite: "loot-ahoy-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitH2Oh: defineOutfitSkin("outfitBase", {
        name: "H2Oh",
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
            sprite: "loot-h2oh-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-soap-pods.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-soap-pods.img",
        },
        lootImg: {
            sprite: "loot-soap-pods-outfit.img",
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
            sprite: "loot-catchem-ol-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-swords.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-swords.img",
        },
        lootImg: {
            sprite: "loot-swords-outfit.img",
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
            sprite: "loot-scareween-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-tomato-and-cheese.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-tomato-and-cheese.img",
        },
        lootImg: {
            sprite: "loot-tomato-and-cheese-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitColorPalette: defineOutfitSkin("outfitBase", {
        name: "Color Palette",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-color-palette.img",
            handTint: 0xffffff,
            handSprite: "player-hands-color-palette.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-color-palette.img",
        },
        lootImg: {
            sprite: "loot-color-palette-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-turtle-sweater.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-turtle-sweater.img",
        },
        lootImg: {
            sprite: "loot-turtle-sweater-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-chromatic-ctr.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-chromatic-ctr.img",
        },
        lootImg: {
            sprite: "loot-chromatic-ctr-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitBuckTeeth: defineOutfitSkin("outfitBase", {
        name: "Buck Teeth",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-buck-teeth.img",
            handTint: 0xffffff,
            handSprite: "player-hands-buck-teeth.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-buck-teeth.img",
            frontSpritePos: { x: 5, y: 0 },
            frontSprite: "player-accessory-buck-teeth.img",
        },
        lootImg: {
            sprite: "loot-buck-teeth-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitPoinsetee: defineOutfitSkin("outfitBase", {
        name: "Poinsetee",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-poinsetee.img",
            handTint: 0xffffff,
            handSprite: "player-hands-poinsetee.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-poinsetee.img",
            frontSpritePos: { x: -3, y: 0 },
            frontSprite: "player-accessory-poinsetee.img",
        },
        lootImg: {
            sprite: "loot-poinsetee-outfit.img",
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
            backpackTint: 0xffffff,
            backpackSprite: "player-back-snowy-claus.img",
            frontSpritePos: { x: -1, y: 1.4 },
            frontSprite: "player-accessory-snowy-claus.img",
        },
        lootImg: {
            sprite: "loot-snowy-claus-outfit.img",
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
            handSprite: "player-hands-camo-deer.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-camo-deer.img",
            frontSpritePos: { x: 5, y: 0 },
            frontSprite: "player-accessory-camo-deer.img",
        },
        lootImg: {
            sprite: "loot-camo-deer-outfit.img",
            tint: 0xffffff,
        },
    }),

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
            sprite: "loot-wood-fire-outfit.img",
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
            sprite: "loot-blunt-razor-outfit.img",
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
            backpackTint: 0xffffff,
            backpackSprite: "player-back-holdin-hide.img",
        },
        lootImg: {
            sprite: "loot-holdin-hide-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-tribe-shield.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-tribe-shield.img",
        },
        lootImg: {
            sprite: "loot-tribe-shield-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-phoebonachi.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-phoebonachi.img",
        },
        lootImg: {
            sprite: "loot-phoebonachi-outfit.img",
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
            backpackTint: 0xffffff,
            backpackSprite: "player-back-ruppert.img",
        },
        lootImg: {
            sprite: "loot-ruppert-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitTribeMask: defineOutfitSkin("outfitBase", {
        name: "Tribe Mask",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-tribe-mask.img",
            handTint: 0xffffff,
            handSprite: "player-hands-tribe-mask.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-tribe-mask.img",
        },
        lootImg: {
            sprite: "loot-tribe-mask-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitTirelessly: defineOutfitSkin("outfitBase", {
        name: "Tirelessly",
        noDropOnDeath: true,

        rarity: 4,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-tirelessly.img",
            handTint: 0xffffff,
            handSprite: "player-hands-tirelessly.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-tirelessly.img",
        },
        lootImg: {
            sprite: "loot-tirelessly-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-bronto-chop.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-bronto-chop.img",
        },
        lootImg: {
            sprite: "loot-bronto-chop-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitDisasteroid: defineOutfitSkin("outfitBase", {
        name: "Disasteroid",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-disasteroid.img",
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
            sprite: "loot-disasteroid-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-sunrise-blvd.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-sunrise-blvd.img",
        },
        lootImg: {
            sprite: "loot-sunrise-blvd-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitIntoTheGrid: defineOutfitSkin("outfitBase", {
        name: "Into The Grid",
        noDropOnDeath: true,

        rarity: 1,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-into-the-grid.img",
            handTint: 0xffffff,
            handSprite: "player-hands-into-the-grid.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-into-the-grid.img",
        },
        lootImg: {
            sprite: "loot-into-the-grid-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-toontooine.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-toontooine.img",
        },
        lootImg: {
            sprite: "loot-toontooine-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitTunelSun: defineOutfitSkin("outfitBase", {
        name: "Tunel Sun",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-tunel-sun.img",
            handTint: 0xffffff,
            handSprite: "player-hands-tunel-sun.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-tunel-sun.img",
        },
        lootImg: {
            sprite: "loot-tunel-sun-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-bitplosion.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-bitplosion.img",
        },
        lootImg: {
            sprite: "loot-bitplosion-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-space-snout.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-space-snout.img",
        },
        lootImg: {
            sprite: "loot-space-snout-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-bombyman.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-bombyman.img",
        },
        lootImg: {
            sprite: "loot-bombyman-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitIdDie4U: defineOutfitSkin("outfitBase", {
        name: "Id Die 4 U",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-id-die-4-u.img",
            handTint: 0xffffff,
            handSprite: "player-hands-id-die-4-u.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-id-die-4-u.img",
            frontSpritePos: { x: -5, y: 0 },
            frontSprite: "player-accessory-id-die-4-u.img",
        },
        lootImg: {
            sprite: "loot-id-die-4-u-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-neck-napkin.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-neck-napkin.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-neck-napkin.img",
        },
        lootImg: {
            sprite: "loot-neck-napkin-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitTheySeeMeRolling: defineOutfitSkin("outfitBase", {
        name: "They See Me Rolling",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-they-see-me-rolling.img",
            handTint: 0xffffff,
            handSprite: "player-hands-they-see-me-rolling.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-they-see-me-rolling.img",
            frontSpritePos: { x: 0, y: 0 },
            frontSprite: "player-accessory-they-see-me-rolling.img",
        },
        lootImg: {
            sprite: "loot-they-see-me-rolling-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitCaptnCactus: defineOutfitSkin("outfitBase", {
        name: "Captn Cactus",
        noDropOnDeath: true,

        rarity: 2,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-captn-cactus.img",
            handTint: 0xffffff,
            handSprite: "player-hands-captn-cactus.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-captn-cactus.img",
        },
        lootImg: {
            sprite: "loot-captn-cactus-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitGoodFeather: defineOutfitSkin("outfitBase", {
        name: "Good Feather",
        noDropOnDeath: true,

        rarity: 3,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-good-feather.img",
            handTint: 0xffffff,
            handSprite: "player-hands-good-feather.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-good-feather.img",
            frontSpritePos: { x: -8, y: 0 },
            frontSprite: "player-accessory-good-feather.img",
        },
        lootImg: {
            sprite: "loot-good-feather-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-nacho-hat.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-nacho-hat.img",
            frontSpritePos: { x: -10, y: 0 },
            frontSprite: "player-accessory-nacho-hat.img",
        },
        lootImg: {
            sprite: "loot-nacho-hat-outfit.img",
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
            backpackTint: 0xffffff,
            backpackSprite: "player-back-suppa-poncho.img",
            frontSpritePos: { x: -11, y: 0 },
            frontSprite: "player-accessory-suppa-poncho.img",
        },
        lootImg: {
            sprite: "loot-suppa-poncho-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-ranch-dressing.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-ranch-dressing.img",
            frontSpritePos: { x: -4.3, y: -2 },
            frontSprite: "player-accessory-ranch-dressing.img",
        },
        lootImg: {
            sprite: "loot-ranch-dressing-outfit.img",
            tint: 0xffffff,
        },
    }),

    outfitSirLoin: defineOutfitSkin("outfitBase", {
        name: "Sir Loin",
        noDropOnDeath: true,

        rarity: 5,
        skinImg: {
            baseTint: 0xffffff,
            baseSprite: "player-base-sir-loin.img",
            handTint: 0xffffff,
            handSprite: "player-hands-sir-loin.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-sir-loin.img",
            frontSpritePos: { x: 3, y: 0 },
            frontSprite: "player-accessory-sir-loin.img",
        },
        lootImg: {
            sprite: "loot-sir-loin-outfit.img",
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
            backpackTint: 0xffffff,
            backpackSprite: "player-back-moosli.img",
            frontSpritePos: { x: 3, y: 0 },
            frontSprite: "player-accessory-moosli.img",
        },
        lootImg: {
            sprite: "loot-moosli-outfit.img",
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
            handTint: 0xffffff,
            handSprite: "player-hands-prey-dinner.img",
            footTint: 0xffffff,
            footSprite: "player-feet-01.img",
            backpackTint: 0xffffff,
            backpackSprite: "player-back-prey-dinner.img",
        },
        lootImg: {
            sprite: "loot-prey-dinner-outfit.img",
            tint: 0xffffff,
        },
    }),
};

export const OutfitDefs = { ...BaseDefs, ...SkinDefs };
