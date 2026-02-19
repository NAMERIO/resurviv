import type { Atlas } from "../../shared/defs/mapDefs";
import { CobaltAtlas } from "./defs/cobalt";
import { DesertAtlas } from "./defs/desert";
import { FactionAtlas } from "./defs/faction";
import { GradientAtlas } from "./defs/gradient";
import { HalloweenAtlas } from "./defs/halloween";
import { LoadoutAtlas } from "./defs/loadout";
import { MainAtlas } from "./defs/main";
import { PerksAtlas } from "./defs/perks";
import { PotatoAtlas } from "./defs/potato";
import { SavannahAtlas } from "./defs/savannah";
import { SharedAtlas } from "./defs/shared";
import { SnowAtlas } from "./defs/snow";
import { TurkeyAtlas } from "./defs/turkey";
import { WoodsAtlas } from "./defs/woods";
import { ValentineAtlas } from "./defs/valentine";
// import { MayAtlas } from "./defs/may";

export interface AtlasDef {
    /**
     * Some atlases have extra quality compression disabled (like loadout).
     *
     * The quality compression works by limiting the image to 256 colors
     *
     * Which doesn't work for some atlases like loadout, gradient, etc...
     * since they have way more colors than the spritesheets with only map objects.
     *
     * This is what the original game did BTW, with this we get really similar (and small) file sizes.
     */
    compress: boolean;
    images: string[];
}

export const Atlases: Record<Atlas, AtlasDef> = {
    gradient: GradientAtlas,
    loadout: LoadoutAtlas,
    shared: SharedAtlas,
    main: MainAtlas,
    desert: DesertAtlas,
    faction: FactionAtlas,
    halloween: HalloweenAtlas,
    potato: PotatoAtlas,
    snow: SnowAtlas,
    woods: WoodsAtlas,
    cobalt: CobaltAtlas,
    savannah: SavannahAtlas,
    // may: MayAtlas,
    turkey: TurkeyAtlas,
    perks: PerksAtlas,
    valentine: ValentineAtlas,
};
export type AtlasRes = "high" | "low";

export const AtlasResolutions: Record<AtlasRes, number> = {
    high: 1,
    low: 0.5,
};

// sprites that are scaled inside the sheets
export const scaledSprites: Record<string, number> = {
    // Smaller ceilings
    "map/map-building-house-ceiling.svg": 0.75,
    "map/map-building-hut-ceiling-01.svg": 0.75,
    "map/map-building-hut-ceiling-02.svg": 0.75,
    "map/map-building-hut-ceiling-03.svg": 0.75,
    "map/map-building-police-ceiling-01.svg": 0.75,
    "map/map-building-police-ceiling-02.svg": 0.75,
    "map/map-building-police-ceiling-03.svg": 0.75,
    "map/map-building-police-ceiling-01p.svg": 0.75,
    "map/map-building-police-ceiling-02p.svg": 0.75,
    "map/map-building-police-ceiling-03p.svg": 0.75,
    "map/map-building-shack-ceiling-01.svg": 0.75,
    "map/map-building-shack-ceiling-02.svg": 0.75,
    "map/map-building-barn-ceiling-02.svg": 0.75,

    // Larger ceilings
    "map/map-building-barn-ceiling-01.svg": 0.5,
    "map/map-building-mansion-ceiling.svg": 0.5,
    "map/map-building-vault-ceiling.svg": 0.5,
    "map/map-building-warehouse-ceiling-01.svg": 0.5,
    "map/map-building-warehouse-ceiling-02.svg": 0.5,
    "map/map-bunker-conch-chamber-ceiling-01.svg": 0.5,
    "map/map-bunker-conch-chamber-ceiling-02.svg": 0.5,
    "map/map-bunker-conch-compartment-ceiling-01.svg": 0.5,
    "map/map-bunker-egg-chamber-ceiling-01.svg": 0.5,
    "map/map-bunker-storm-chamber-ceiling-01.svg": 0.5,
    "map/map-bunker-hydra-ceiling-01.svg": 0.5,
    "map/map-bunker-hydra-chamber-ceiling-01.svg": 0.5,
    "map/map-bunker-hydra-chamber-ceiling-02.svg": 0.5,
    "map/map-bunker-hydra-chamber-ceiling-03.svg": 0.5,
    "map/map-bunker-hydra-compartment-ceiling-02.svg": 0.5,
    "map/map-bunker-hydra-compartment-ceiling-03.svg": 0.5,
};

export const rotatedSprites: Record<string, number> = {
    // bonkbonk
    "player/player-fists-bonkbonk-l.svg": 90,
    "player/player-fists-bonkbonk-r.svg": 90,
    // cattle battle
    "player/player-fists-cattle-battle-l.svg": 90,
    "player/player-fists-cattle-battle-r.svg": 90,
    // coco nut
    "player/player-fists-coco-nut-l.svg": 90,
    "player/player-fists-coco-nut-r.svg": 90,
    // develop these rolls
    "player/player-fists-develop-these-rolls-l.svg": 90,
    "player/player-fists-develop-these-rolls-r.svg": 90,
    // flashy
    "player/player-fists-flashy-l.svg": 90,
    "player/player-fists-flashy-r.svg": 90,
    // fritter punch
    "player/player-fists-fritter-punch-l.svg": 90,
    "player/player-fists-fritter-punch-r.svg": 90,
    // fuzzy hooves
    "player/player-fists-fuzzy-hooves-l.svg": 90,
    "player/player-fists-fuzzy-hooves-r.svg": 90,
    // gold drops
    "player/player-fists-gold-drops-l.svg": 90,
    "player/player-fists-gold-drops-r.svg": 90,
    // golden lobster
    "player/player-fists-golden-lobster-l.svg": 90,
    "player/player-fists-golden-lobster-r.svg": 90,
    // milkshaked
    "player/player-fists-milkshaked-l.svg": 90,
    "player/player-fists-milkshaked-r.svg": 90,
    // no pine no gain
    "player/player-fists-no-pine-no-gain-l.svg": 90,
    "player/player-fists-no-pine-no-gain-r.svg": 90,
    // paddle
    "player/player-fists-paddle-l.svg": 90,
    "player/player-fists-paddle-r.svg": 90,
    // paws
    "player/player-hands-paws.svg": 90,
    // pine fury
    "player/player-hands-pineFury-left.svg": 90,
    "player/player-hands-pineFury-right.svg": 90,
    // poke
    "player/player-hands-poke.svg": 90,
    // q fist
    "player/player-fists-q-fist-l.svg": 90,
    "player/player-fists-q-fist-r.svg": 90,
    // ranger
    "player/player-hands-ranger.svg": 90,
    // santa mittens
    "player/player-fists-santa-l.svg": 90,
    "player/player-fists-santa-r.svg": 90,
    // stonedgy
    "player/player-fists-stonedgy-l.svg": 90,
    "player/player-fists-stonedgy-r.svg": 90,
    // the other pong
    "player/player-fists-the-other-pong-l.svg": 90,
    "player/player-fists-the-other-pong-r.svg": 90,
    // tiger seed
    "player/player-fists-tiger-seed-l.svg": 90,
    "player/player-fists-tiger-seed-r.svg": 90,
    // wrecked angle
    "player/player-fists-wrecked-angle-l.svg": 90,
    "player/player-fists-wrecked-angle-r.svg": 90,
};
