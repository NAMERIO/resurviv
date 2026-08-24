import type { AtlasDef } from "../atlasDefs";
import { BuildingSprites } from "./buildings";

export const MainAtlas: AtlasDef = {
    compress: true,
    images: [
        ...BuildingSprites.greenhouse,
        ...BuildingSprites.bunker_chrys,

        "map/map-tree-07.svg",
        "map/map-tree-07sp.svg",
        "map/map-tree-08sp.svg",
        "map/map-stone-03tw.svg",
        "map/map-stone-res-02tw.svg",
        "map/map-bush-01f.svg",
    ],
};
