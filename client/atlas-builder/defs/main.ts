import type { AtlasDef } from "../atlasDefs";
import { BuildingSprites } from "./buildings";

export const MainAtlas: AtlasDef = {
    compress: true,
    images: [
        ...BuildingSprites.greenhouse,
        ...BuildingSprites.bunker_chrys,

        "map/map-stone-03tw.svg",
        "map/map-stone-res-02tw.svg",
        "map/map-bush-01f.svg",
    ],
};
