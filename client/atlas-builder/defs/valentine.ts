import type { AtlasDef } from "../atlasDefs";
import { BuildingSprites } from "./buildings";

export const ValentineAtlas: AtlasDef = {
    compress: true,
    images: [
        ...BuildingSprites.bunker_crossing,
        ...BuildingSprites.bunker_hydra,
        ...BuildingSprites.bunker_twins,
        "map/map-tree-13.svg",
        "map/bush-rose.svg",
        "map/map-bush-07sp.svg",
        "map/map-candy-store-basket.svg",
        "map/map-candy-store-display-01.svg",
        "map/map-candy-store-display-02.svg",
        "map/map-candy-store-display-03.svg",
        "map/map-candy-store-display-04.svg",
        "map/map-candy-store-display-05.svg",
        "map/map-candy-store-display-06.svg",
        "map/map-candy-store-front-desk.svg",
        "map/map-crate-02b.svg",
        "map/map-crate-frenemies-metal.svg",
        "map/map-candy-store-ceiling-01.svg",
        "map/map-candy-store-firstfloor.svg",
        "map/map-tree-07sp.svg",
        "map/map-tree-08sp.svg",
        "map/map-bush-13.svg",
        "map/map-bush-res-13.svg",
        "map/map-candy-store-basement-floor.svg",
        "map/vending_01v.svg",
        "map/map-displays-res.svg",
        "map/map-candy-store-basket-res.svg",
    ],
};
