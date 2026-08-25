import type { AtlasDef } from "../atlasDefs";
import { BuildingSprites } from "./buildings";

export const BedWarAtlas: AtlasDef = {
    compress: true,
    images: [
        ...BuildingSprites.pavilion,
        ...BuildingSprites.shilo,
        ...BuildingSprites.workshop,
        "map/map-campfire-01.svg",
        "map/map-crate-03x.svg",
        "map/map-crate-19.svg",
        "map/map-safe-01.svg",
        "map/map-statue-01.svg",
        "map/map-table-04.svg",
        "map/map-table-res-02.svg",
        "map/map-web-01.svg",
        "map/map-woodpile-02.svg",
        "map/map-woodpile-03.svg",
        "map/map-woodpile-res-02.svg",
        "map/map-woodpile-res-03.svg",
    ],
};
