import { Rarity } from "../../gameConfig";

export interface GunSkinDef {
    readonly type: "gun_skin";
    name: string;
    lore?: string;
    rarity: Rarity;
    gunType: string;
    worldImg: {
        sprite: string;
        onLoadComplete?: string;
        tint?: number;
    };
}

export const GunSkinDefs: Record<string, GunSkinDef> = {
    mosin_gilded: {
        type: "gun_skin",
        name: "Gilded Mosin",
        rarity: Rarity.Mythic,
        gunType: "mosin",
        worldImg: {
            sprite: "gun-mosin-gilded.img",
        },
    },
    mosin_camo: {
        type: "gun_skin",
        name: "Camo Mosin",
        rarity: Rarity.Epic,
        gunType: "mosin",
        worldImg: {
            sprite: "gun-mosin-camo.img",
        },
    },
    spas16_jackolantern: {
        type: "gun_skin",
        name: "Jack-o'-Lantern SPAS-12",
        lore: "Carved fresh every Halloween. Loaded with candy corn.",
        rarity: Rarity.Mythic,
        gunType: "spas12",
        worldImg: {
            sprite: "gun-spas16-jackolantern.img",
        },
    },
};
