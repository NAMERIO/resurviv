import type { Collider } from "../utils/coldet";
import { collider } from "../utils/collider";
import { v2 } from "../utils/v2";
import type { TerrainSpawnDef } from "./mapObjectsTyping";

export interface NpcImageDef {
    sprite: string;
    residue: string;
    scale: number;
    alpha: number;
    tint: number;
    zIdx: number;
}

export interface NpcStateDef {
    name: string;
    animation:
        | "base_motherShip"
        | "fusion_motherShip"
        | "load_motherShip"
        | "skitter_base"
        | "none";
}

export interface NpcDef {
    readonly type: "npc";
    collision: Collider;
    height: number;
    collidable: boolean;
    destructible: boolean;
    reflectBullets: boolean;
    health: number;
    hitParticle: string;
    explodeParticle: string;
    img: NpcImageDef;
    states: NpcStateDef[];
    movementSpeed: number;
    movementPattern: "circle" | "target";
    initialState: string;
    mapIndicator: boolean;
    terrain: TerrainSpawnDef;
    sound: {
        bullet: string;
        punch: string;
        explode: string;
        enter: string;
    };
    attackInterval?: number;
    spawnType?: string;
    minSpawn?: number;
    maxSpawn?: number;
    timeForFusion?: number;
    hasGun?: boolean;
    moveInterval?: [number, number];
    gunImg?: NpcImageDef;
}

export const NpcDefs: Record<string, NpcDef> = {
    motherShip: {
        type: "npc",
        collision: collider.createCircle(v2.create(0, 0), 12),
        height: 0.2,
        collidable: false,
        destructible: false,
        reflectBullets: false,
        health: 75,
        hitParticle: "woodChip",
        explodeParticle: "woodPlank",
        img: {
            sprite: "map-spaceship-01.img",
            residue: "map-crate-res-01.img",
            scale: 0.5,
            alpha: 1,
            tint: 0xffffff,
            zIdx: 802,
        },
        states: [
            { name: "base", animation: "base_motherShip" },
            { name: "fusion", animation: "fusion_motherShip" },
            { name: "cannon", animation: "load_motherShip" },
        ],
        movementSpeed: 14,
        movementPattern: "circle",
        initialState: "base",
        mapIndicator: true,
        terrain: { grass: true, beach: true, riverShore: true },
        sound: {
            bullet: "wood_crate_bullet",
            punch: "wood_crate_bullet",
            explode: "crate_break_02",
            enter: "none",
        },
        attackInterval: 25,
        spawnType: "skitter",
        maxSpawn: 4,
        minSpawn: 4,
        timeForFusion: 250,
        hasGun: true,
        gunImg: {
            sprite: "map-cannon-01.img",
            residue: "part-splat-01.img",
            scale: 0.6,
            alpha: 1,
            tint: 0xffffff,
            zIdx: 10,
        },
    },
    skitter: {
        type: "npc",
        collision: collider.createCircle(v2.create(0, 0), 1.2),
        height: 0.5,
        collidable: true,
        destructible: true,
        reflectBullets: false,
        health: 50,
        hitParticle: "skitterBlood",
        explodeParticle: "skitterBlood",
        img: {
            sprite: "skitter-walking-1.img",
            residue: "map-skitter-res.img",
            scale: 0.6,
            alpha: 1,
            tint: 0xffffff,
            zIdx: 10,
        },
        states: [
            { name: "base", animation: "skitter_base" },
            { name: "spin", animation: "none" },
        ],
        movementSpeed: 90,
        movementPattern: "target",
        initialState: "base",
        mapIndicator: false,
        terrain: { grass: true, beach: true, riverShore: true },
        sound: {
            bullet: "skitter_hit",
            punch: "skitter_hit",
            explode: "skitter_destroy_01",
            enter: "none",
        },
        moveInterval: [0.5, 1],
    },
};
