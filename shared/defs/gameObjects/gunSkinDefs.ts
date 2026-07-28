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
};
