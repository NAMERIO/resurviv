import type { AtlasDef } from "../atlasDefs";
import { BuildingSprites } from "./buildings";

export const InfernoAtlas: AtlasDef = {
    compress: true,
    images: [
        ...BuildingSprites.pavilion,
        "map/map-bush-14a.svg",
        "map/map-bush-14b.svg",
        "map/map-crate-pyre-res.svg",
        "map/map-pyre-01.svg",
        "map/map-tree-20.svg",
        "map/map-bush-res-14b.svg",
        "map/map-stone-03l.svg",
        "map/map-stone-res-01l.svg",

        "map/map-tree-07.svg",
    ],
};
