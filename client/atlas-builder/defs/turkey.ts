import type { AtlasDef } from "../atlasDefs";
import { BuildingSprites } from "./buildings";

export const TurkeyAtlas: AtlasDef = {
    compress: true,
    images: [
        ...BuildingSprites.greenhouse,
        ...BuildingSprites.bunker_chrys,

        "map/map-squash-02.svg",
        "map/map-squash-03.svg",

        "map/map-squash-res-02.svg",
        "map/map-squash-res-03.svg",

        "map/map-tree-08.svg",

        "map/map-bush-06tr.svg",
        "map/map-bush-res-06.svg",

        "map/map-stone-03tr.svg",
        "map/map-chest-03tr.svg",
        "map/map-stone-res-02x.svg",
    ],
};
