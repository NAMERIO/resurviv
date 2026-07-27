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
    };
}

export const GunSkinDefs: Record<string, GunSkinDef> = {
    mosin_gilded: {
        type: "gun_skin",
        name: "Gilded Mosin",
        rarity: Rarity.Rare,
        gunType: "mosin",
        worldImg: {
            sprite: "gun-mosin-gilded.img",
        },
    },
};
