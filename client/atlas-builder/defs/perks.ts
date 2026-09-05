import type { AtlasDef } from "../atlasDefs";
import { BuildingSprites } from "./buildings";

export const PerksAtlas: AtlasDef = {
    compress: true,
    images: [
        ...BuildingSprites.reactor,
        ...BuildingSprites.bunker_chrys_aged,
        ...BuildingSprites.greenhouse_aged,

        "map/map-case-meteor-01.svg",

        "map/map-silo-09.svg",
        "map/map-vat-eye.svg",
        "map/map-vat-h20.svg",
        "map/map-vat-space-snout.svg",
        "map/map-vat-cosmic-blue.svg",
        "map/map-vat-brain.svg",
        "map/map-vat-explosive.svg",
        "map/map-airdrop-01p.svg",
        "map/map-airdrop-02p.svg",
        "map/map-chute-01p.svg",
        "map/map-crate-11p.svg",
        "map/map-crate-10p.svg",
        "map/map-crate-02p.svg",
        "map/map-crate-01p.svg",
        "map/map-bush-01p.svg",
        "map/map-bush-07p.svg",
        "map/map-bush-res-01p.svg",
        "map/map-tree-01p.svg",
        "map/map-tree-13p.svg",

        "map/map-gun-mount-lasr.svg",
        "map/map-gun-mount-flux-rifle.svg",

        "map/map-tree-07.svg",
    ],
};
