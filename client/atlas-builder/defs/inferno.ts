import type { AtlasDef } from "../atlasDefs";
import { BuildingSprites } from "./buildings";

export const InfernoAtlas: AtlasDef = {
    compress: true,
    images: [
        ...BuildingSprites.pavilion,
        "map/map-bush-04i.svg",
        "map/map-bush-res-04i.svg",
        "map/map-bush-05i.svg",
        "map/map-bush-res-05i.svg",
        "map/map-crate-pyre.svg",
        "map/map-tree-05i.svg",
        "map/map-tree-13i.svg",
        "map/map-stone-01i.svg",
        "map/map-stone-res-01i.svg",
        "map/map-stone-03i.svg",
        "map/map-stone-res-02i.svg",

        "map/map-tree-07.img",

        "particles/part-snow-01.svg",
    ],
};
