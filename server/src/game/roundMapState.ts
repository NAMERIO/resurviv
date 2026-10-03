import { ObjectType } from "../../../shared/net/objectSerializeFns";
import { v2 } from "../../../shared/utils/v2";
import { type GameMap, MapGrid } from "./map";
import { Building } from "./objects/building";
import { Decal } from "./objects/decal";
import { Loot } from "./objects/loot";
import { Obstacle } from "./objects/obstacle";
import { Structure } from "./objects/structure";

type MapObject = Obstacle | Building | Structure | Decal | Loot;
type RestoredObjects = Map<number, MapObject>;

// Save resolved spawns: the terrain seed does not determine object placement.
export class RoundMapState {
    private readonly spawns: Array<{
        id: number;
        create: (objects: RestoredObjects) => MapObject;
    }> = [];
    private readonly linkChildren: Array<(objects: RestoredObjects) => void> = [];
    private readonly colliders;
    private readonly mapObjects;
    private readonly bridgeIds;
    private readonly twinsBunkerId;

    constructor(private readonly map: GameMap) {
        const game = map.game;
        this.colliders = structuredClone(map.grid.intersectCollider(map.bounds));
        this.mapObjects = map.msg.objects.map(({ type, pos, ori, scale }) => ({
            type,
            pos: v2.copy(pos),
            ori,
            scale,
        }));
        this.bridgeIds = map.bridges.map((bridge) => bridge.__id);
        this.twinsBunkerId = map.perkModeTwinsBunker?.__id;

        for (const obj of game.objectRegister.objects) {
            if (!obj || obj.destroyed || ("isSkin" in obj && obj.isSkin)) continue;
            const id = obj.__id;
            const pos = v2.copy(obj.pos);
            const layer = obj.layer;
            switch (obj.__type) {
                case ObjectType.Obstacle: {
                    const {
                        type,
                        ori,
                        scale,
                        originalLayer,
                        parentBuildingId,
                        puzzlePiece,
                    } = obj;
                    this.spawns.push({
                        id,
                        create: (objects) => {
                            const obstacle = new Obstacle(
                                game,
                                pos,
                                type,
                                originalLayer,
                                ori,
                                scale,
                                objects.get(parentBuildingId ?? 0)?.__id,
                                puzzlePiece,
                            );
                            map.obstacles.push(obstacle);
                            if (obstacle.isDynamic) map.dynamicObstacles.push(obstacle);
                            return obstacle;
                        },
                    });
                    break;
                }
                case ObjectType.Building: {
                    const { type, ori } = obj;
                    const parentId = obj.parentStructure?.__id;
                    const childIds = obj.childObjects.map((child) => child.__id);
                    this.spawns.push({
                        id,
                        create: (objects) => {
                            const building = new Building(
                                game,
                                type,
                                pos,
                                ori,
                                layer,
                                objects.get(parentId ?? 0)?.__id,
                            );
                            map.buildings.push(building);
                            if (building.hasOccupiedEmitters)
                                map.buildingsWithEmitters.push(building);
                            return building;
                        },
                    });
                    this.linkChildren.push((objects) => {
                        const building = objects.get(id) as Building;
                        building.childObjects = childIds.map(
                            (childId) => objects.get(childId)!,
                        ) as Building["childObjects"];
                    });
                    break;
                }
                case ObjectType.Structure: {
                    const { type, ori } = obj;
                    const layerIds = [...obj.layerObjIds];
                    this.spawns.push({
                        id,
                        create: () => {
                            const structure = new Structure(game, type, pos, layer, ori);
                            map.structures.push(structure);
                            return structure;
                        },
                    });
                    this.linkChildren.push((objects) => {
                        const structure = objects.get(id) as Structure;
                        structure.layerObjIds = layerIds.map(
                            (layerId) => objects.get(layerId)!.__id,
                        );
                    });
                    break;
                }
                case ObjectType.Decal: {
                    const { type, ori, scale, lifeTime } = obj;
                    this.spawns.push({
                        id,
                        create: () => {
                            const decal = new Decal(game, type, pos, layer, ori, scale);
                            decal.lifeTime = lifeTime;
                            game.decalBarn.decals.push(decal);
                            return decal;
                        },
                    });
                    break;
                }
                case ObjectType.Loot: {
                    const { type, count, isPreloadedGun } = obj;
                    const vel = v2.copy(obj.vel);
                    this.spawns.push({
                        id,
                        create: () => {
                            const loot = new Loot(game, type, pos, layer, count, 0);
                            loot.vel = v2.copy(vel);
                            loot.isPreloadedGun = isPreloadedGun;
                            game.lootBarn.loots.push(loot);
                            game.lootBarn.newLoots.push(loot);
                            return loot;
                        },
                    });
                    break;
                }
            }
        }
    }

    restore(): void {
        const map = this.map;
        const game = map.game;
        for (const obj of game.objectRegister.objects) {
            if (!obj || obj.destroyed || ("isSkin" in obj && obj.isSkin)) continue;
            if (obj.__type === ObjectType.Building && obj.puzzleResetTimeout) {
                clearTimeout(obj.puzzleResetTimeout);
            }
            if (
                [
                    ObjectType.Obstacle,
                    ObjectType.Building,
                    ObjectType.Structure,
                    ObjectType.Decal,
                    ObjectType.Loot,
                ].includes(obj.__type)
            )
                obj.destroy();
        }
        game.lootBarn.loots = game.lootBarn.loots.filter(
            (obj) => obj.isSkin && !obj.destroyed,
        );
        game.lootBarn.newLoots = game.lootBarn.newLoots.filter(
            (obj) => obj.isSkin && !obj.destroyed,
        );
        map.obstacles = map.obstacles.filter((obj) => obj.isSkin && !obj.destroyed);
        map.dynamicObstacles = map.dynamicObstacles.filter(
            (obj) => obj.isSkin && !obj.destroyed,
        );
        map.buildings = [];
        map.buildingsWithEmitters = [];
        map.structures = [];
        map.scheduledUnlocks = [];
        map.unlocks = [];
        map.grid = new MapGrid(map.width, map.height);
        for (const coll of structuredClone(this.colliders)) map.grid.addCollider(coll);
        map.msg.objects = this.mapObjects.map((obj) => ({
            ...obj,
            pos: v2.copy(obj.pos),
        }));

        const objects: RestoredObjects = new Map();
        for (const spawn of this.spawns) {
            const obj = spawn.create(objects);
            game.objectRegister.register(obj);
            objects.set(spawn.id, obj);
        }
        for (const link of this.linkChildren) link(objects);
        map.bridges = this.bridgeIds.map((id) => objects.get(id) as Structure);
        map.perkModeTwinsBunker = objects.get(this.twinsBunkerId ?? 0) as
            | Building
            | undefined;
    }
}
