import { GameObjectDefs } from "../../../../shared/defs/gameObjectDefs";
import type { ThrowableDef } from "../../../../shared/defs/gameObjects/throwableDefs";
import { type NpcDef, NpcDefs } from "../../../../shared/defs/npcDefs";
import { GameConfig } from "../../../../shared/gameConfig";
import { ObjectType } from "../../../../shared/net/objectSerializeFns";
import { type AABB, type Collider, coldet } from "../../../../shared/utils/coldet";
import { collider } from "../../../../shared/utils/collider";
import { math } from "../../../../shared/utils/math";
import { util } from "../../../../shared/utils/util";
import { type Vec2, v2 } from "../../../../shared/utils/v2";
import type { Game } from "../game";
import type { Building } from "./building";
import { BaseGameObject, type DamageParams } from "./gameObject";
import type { MapIndicator } from "./mapIndicator";
import type { Obstacle } from "./obstacle";
import type { Player } from "./player";
import type { Projectile } from "./projectile";

const spriteUnitsPerGameUnit = 16;
const secondStageTime = 4 * 60;
const secondStageSpawnInterval = 15;
const cannonChargeTime = 2;
const cannonRange = GameConfig.scopeZoomRadius.desktop["2xscope"];
const skitterDamage = 5;
const skitterDoorwayOffset = 0.75;
const skitterDoorwayReach = 0.75;
const maxLivingSkitters = 10;
const skitterRespawnDelay = 15;
const motherShipPatrolAngularSpeed = 0.02;
const motherShipPatrolRadialSpeed = 0.045;
const motherShipPatrolMaxRadius = 32;
const motherShipPatrolMinRadius = 6;

interface AddNpcOptions {
    bypassSkitterCap?: boolean;
}

interface BuildingLocation {
    building: Building;
    region: AABB;
}

interface DoorRoute {
    door: Obstacle;
    bounds: AABB;
    inside: Vec2;
    outside: Vec2;
    edgeDistance: number;
}

export class NpcBarn {
    npcs: Npc[] = [];
    private pendingSkitterRespawns: number[] = [];

    constructor(readonly game: Game) {}

    init() {
        const npcSpawns = this.game.map.mapDef.gameMode.npcSpawns ?? {};
        for (const [type, configuredCount] of Object.entries(npcSpawns)) {
            if (!NpcDefs[type]) {
                throw new Error(`Invalid NPC spawn type ${type}`);
            }

            const count = Math.max(0, Math.floor(configuredCount));
            for (let i = 0; i < count; i++) {
                const spawnPos = this.getNpcSpawnPos(type);
                this.addNpc(type, spawnPos);
            }
        }
    }

    private getNpcSpawnPos(type: string) {
        const def = NpcDefs[type];
        let spawnPos = v2.create(0, 0);

        for (let attempt = 0; attempt < 100; attempt++) {
            spawnPos = this.game.map.getRandomSpawnPos(() =>
                util.randomPointInAabb(this.game.map.grassBounds),
            );
            const spawnCollider = collider.transform(def.collision, spawnPos, 0, 1);
            if (this.npcs.every((npc) => !coldet.test(spawnCollider, npc.collider))) {
                break;
            }
        }

        return spawnPos;
    }

    addNpc(type: string, pos: Vec2, layer = 0, options: AddNpcOptions = {}) {
        if (
            type === "skitter" &&
            !options.bypassSkitterCap &&
            this.getLivingSkitterCount() + this.pendingSkitterRespawns.length >=
                maxLivingSkitters
        ) {
            return undefined;
        }

        const npc = new Npc(this.game, type, pos, layer);
        this.npcs.push(npc);
        this.game.objectRegister.register(npc);
        return npc;
    }

    update(dt: number) {
        this.updateSkitterRespawns(dt);

        for (let i = 0; i < this.npcs.length; i++) {
            const npc = this.npcs[i];
            if (npc.destroyed) {
                this.npcs.splice(i, 1);
                i--;
                continue;
            }
            npc.update(dt);
        }
    }

    scheduleSkitterRespawn() {
        const hasLivingMotherShip = this.npcs.some(
            (npc) => npc.type === "motherShip" && !npc.dead && !npc.destroyed,
        );
        if (!hasLivingMotherShip) return;
        this.pendingSkitterRespawns.push(skitterRespawnDelay);
    }

    getLivingSkitterCount() {
        return this.npcs.reduce(
            (count, npc) =>
                count + (npc.type === "skitter" && !npc.dead && !npc.destroyed ? 1 : 0),
            0,
        );
    }

    private updateSkitterRespawns(dt: number) {
        if (this.game.playerBarn.livingPlayers.length === 0) return;

        for (let i = this.pendingSkitterRespawns.length - 1; i >= 0; i--) {
            this.pendingSkitterRespawns[i] -= dt;
            if (this.pendingSkitterRespawns[i] > 0) continue;

            this.pendingSkitterRespawns.splice(i, 1);
            const motherShips = this.npcs.filter(
                (npc) => npc.type === "motherShip" && !npc.dead && !npc.destroyed,
            );
            if (!motherShips.length) continue;

            const motherShip = motherShips[util.randomInt(0, motherShips.length - 1)];
            this.addNpc(
                "skitter",
                v2.add(motherShip.pos, util.randomPointInCircle(3)),
                motherShip.layer,
            );
        }
    }
}

export class Npc extends BaseGameObject {
    override readonly __type = ObjectType.Npc;

    bounds: AABB;
    collider: Collider;
    layer: number;
    type: string;
    obstacleType = "";
    ori = 0;
    scale = 1;
    state: string;
    invisibleTicker = false;
    targetActive = false;
    targetPos = v2.create(0, 0);
    dead = false;
    teamId = 0;
    healthT = 1;
    health: number;
    maxHealth: number;
    collidable: boolean;
    destructible: boolean;
    height: number;

    private spawnTicker = 0;
    private cannonTicker = 0;
    private cannonReady = false;
    private cannonTarget?: Player;
    private cannonProjectile?: Projectile;
    private biteTicker = 0;
    private phaseTicker = 0;
    private enteredSecondStage = false;
    private motherShipPatrolTime = 0;
    private mapIndicator?: MapIndicator;
    private navigationBuilding?: Building;
    private navigationDoor?: Obstacle;
    private navigationEntering = false;
    private navigationCrossingDoor = false;

    constructor(game: Game, type: string, pos: Vec2, layer: number) {
        super(game, pos);
        const def = NpcDefs[type];
        if (!def) throw new Error(`Invalid NPC type ${type}`);

        this.type = type;
        this.layer = layer;
        this.state = def.initialState;
        this.health = def.health;
        this.maxHealth = def.health;
        this.collidable = def.collidable;
        this.destructible = def.destructible;
        this.height = def.height;
        this.bounds = collider.toAabb(
            collider.transform(def.collision, v2.create(0, 0), this.ori, this.scale),
        );
        this.collider = collider.transform(def.collision, this.pos, this.ori, this.scale);
        this.spawnTicker = def.spawnInterval ?? 0;
        if (def.moveInterval) {
            this.phaseTicker = util.random(def.moveInterval[0], def.moveInterval[1]);
        }
        if (def.mapIndicator) {
            this.mapIndicator = game.mapIndicatorBarn.allocIndicator(type, true);
            this.mapIndicator?.updatePosition(this.pos);
        }
    }

    update(dt: number) {
        if (this.dead) return;

        if (this.type === "motherShip") {
            this.updateMotherShip(dt);
        } else if (this.type === "skitter") {
            this.updateSkitter(dt);
        }
    }

    private updateMotherShip(dt: number) {
        const def = NpcDefs.motherShip;

        this.motherShipPatrolTime += dt;
        this.moveToward(this.getMotherShipMoveTarget(), def.movementSpeed, dt, false);

        if (this.cannonProjectile?.destroyed) {
            this.cannonProjectile = undefined;
            this.clearCannonMarker();
        }

        if (!this.enteredSecondStage && this.game.startedTime >= secondStageTime) {
            this.enteredSecondStage = true;
            if (!this.cannonTarget) this.setState("fusion");
        }

        if (this.cannonTarget) {
            const target = this.cannonTarget;
            if (!this.isEligibleCannonTarget(target)) {
                this.clearCannonTarget();
                this.cannonReady = true;
            } else {
                this.aimCannonAt(target);
                this.cannonTicker -= dt;
                if (this.cannonTicker <= 0) {
                    const targetPos = v2.copy(target.pos);
                    const targetLayer = target.layer;
                    this.targetPos = v2.copy(targetPos);
                    this.setPartDirty();
                    this.clearCannonTarget(false);
                    this.cannonProjectile = this.fireCannon(targetPos, targetLayer);
                    if (!this.cannonProjectile) this.clearCannonMarker();
                }
            }
        }

        if (this.cannonReady && !this.cannonTarget && !this.cannonProjectile) {
            this.acquireCannonTarget();
        }

        if (this.game.playerBarn.livingPlayers.length === 0) return;

        this.spawnTicker -= dt;
        if (this.spawnTicker > 0) return;

        this.spawnTicker = this.enteredSecondStage
            ? secondStageSpawnInterval
            : (def.spawnInterval ?? 25);
        this.spawnSkitters(def);
        if (!this.cannonTarget && !this.cannonProjectile) {
            this.cannonReady = true;
            this.acquireCannonTarget();
        }
    }

    private getMotherShipMoveTarget() {
        const motherShips = this.game.npcBarn.npcs.filter(
            (npc) => npc.type === "motherShip" && !npc.dead && !npc.destroyed,
        );
        const index = Math.max(motherShips.indexOf(this), 0);
        const formationAngle =
            motherShips.length > 0 ? (index / motherShips.length) * Math.PI * 2 : 0;
        const patrolRadius = Math.max(
            motherShipPatrolMinRadius,
            Math.min(motherShipPatrolMaxRadius, this.game.gas.radNew * 0.2),
        );
        const radius =
            patrolRadius *
            (0.75 +
                Math.sin(
                    this.motherShipPatrolTime * motherShipPatrolRadialSpeed +
                        formationAngle,
                ) *
                    0.2);
        const angle =
            formationAngle + this.motherShipPatrolTime * motherShipPatrolAngularSpeed;
        return v2.add(
            this.game.gas.posNew,
            v2.create(Math.cos(angle) * radius, Math.sin(angle) * radius),
        );
    }

    private spawnSkitters(def: NpcDef) {
        const min = def.minSpawn ?? 1;
        const max = def.maxSpawn ?? min;
        const count = Math.floor(util.random(min, max + 1));
        for (let i = 0; i < count; i++) {
            const pos = v2.add(this.pos, util.randomPointInCircle(3));
            this.game.npcBarn.addNpc(def.spawnType ?? "skitter", pos, this.layer);
        }
    }

    private acquireCannonTarget() {
        const candidates = this.game.playerBarn.livingPlayers.filter((player) =>
            this.isEligibleCannonTarget(player),
        );
        if (candidates.length === 0) return;

        const target = candidates.reduce((furthest, player) =>
            v2.distance(this.pos, player.pos) > v2.distance(this.pos, furthest.pos)
                ? player
                : furthest,
        );
        this.cannonReady = false;
        this.cannonTarget = target;
        this.targetActive = true;
        this.targetPos = v2.copy(target.pos);
        this.cannonTicker = cannonChargeTime;
        this.aimCannonAt(target);
        this.setState("cannon");
    }

    private aimCannonAt(target: Player) {
        this.ori = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);
        this.targetPos = v2.copy(target.pos);
        this.setPartDirty();
    }

    private fireCannon(targetPos: Vec2, targetLayer: number) {
        const def = GameObjectDefs.motherShip_cannon_shot as ThrowableDef;
        const distance = v2.distance(this.pos, targetPos);
        if (distance <= 0.001) return;

        const dir = v2.directionNormalized(this.pos, targetPos);
        const projectile = this.game.projectileBarn.addProjectile(
            this.__id,
            "motherShip_cannon_shot",
            this.pos,
            0.5,
            targetLayer,
            v2.mul(dir, def.throwPhysics.speed),
            Math.min(def.fuseTime, distance / def.throwPhysics.speed),
            GameConfig.DamageType.Npc,
            dir,
            "motherShip_cannon_shot",
        );
        projectile.linearFlight = true;
        projectile.linearTargetPos = v2.copy(targetPos);
        return projectile;
    }

    private isEligibleCannonTarget(player: Player) {
        return (
            !player.dead &&
            !player.downed &&
            !player.indoors &&
            v2.distance(this.pos, player.pos) <= cannonRange &&
            !collider.intersectCircle(this.collider, player.pos, player.rad)
        );
    }

    private clearCannonTarget(clearMarker = true) {
        this.cannonTarget = undefined;
        if (clearMarker) this.clearCannonMarker();
        this.setState(this.enteredSecondStage ? "fusion" : "base");
    }

    private clearCannonMarker() {
        if (!this.targetActive) return;
        this.targetActive = false;
        this.setPartDirty();
    }

    private updateSkitter(dt: number) {
        const moveInterval = NpcDefs.skitter.moveInterval ?? [0.5, 1];
        this.phaseTicker -= dt;
        if (this.phaseTicker <= 0) {
            this.invisibleTicker = !this.invisibleTicker;
            this.phaseTicker = util.random(moveInterval[0], moveInterval[1]);
            this.setPartDirty();
        }

        this.biteTicker -= dt;
        const target = this.findClosestPlayer();
        if (!target) return;

        const distance = v2.distance(this.pos, target.pos);
        if (distance <= this.colliderRadius() + target.rad + 0.25) {
            if (this.biteTicker <= 0) {
                target.damage({
                    amount: skitterDamage,
                    damageType: GameConfig.DamageType.Npc,
                    mapSourceType: "skitter",
                    dir: v2.directionNormalized(target.pos, this.pos),
                    source: this,
                });
                target.biteEffect = true;
                target.biteEffectTicker = 0.3;
                target.setDirty();
                target.applyContactedEffect();
                this.biteTicker = util.random(moveInterval[0], moveInterval[1]);
            }
            return;
        }

        const moveTarget = this.getSkitterMoveTarget(target);
        this.ori = Math.atan2(moveTarget.y - this.pos.y, moveTarget.x - this.pos.x);
        this.moveToward(moveTarget, NpcDefs.skitter.movementSpeed, dt, true);
    }

    private findClosestPlayer() {
        let closest: Player | undefined;
        let closestDistance = Infinity;
        for (const player of this.game.playerBarn.livingPlayers) {
            if (player.dead || player.downed) continue;
            const distance = v2.lengthSqr(v2.sub(player.pos, this.pos));
            if (distance < closestDistance) {
                closest = player;
                closestDistance = distance;
            }
        }
        return closest;
    }

    private moveToward(
        target: Vec2,
        movementSpeed: number,
        dt: number,
        collide: boolean,
    ) {
        const delta = v2.sub(target, this.pos);
        const distance = v2.length(delta);
        if (distance <= 0.001) return;

        const speed = movementSpeed / spriteUnitsPerGameUnit;
        const movement = v2.mul(delta, Math.min(speed * dt, distance) / distance);
        const nextPos = v2.add(this.pos, movement);

        v2.set(this.pos, nextPos);
        this.updateCollider();

        if (collide) {
            this.resolveCollisions();
        }

        this.setPartDirty();
        this.game.grid.updateObject(this);
        this.mapIndicator?.updatePosition(this.pos);
    }

    private resolveCollisions() {
        const objects = this.game.grid.intersectCollider(this.collider);
        const rad = this.colliderRadius();
        for (const object of objects) {
            const collidableObstacle =
                object.__type === ObjectType.Obstacle &&
                !object.dead &&
                object.collidable &&
                util.sameLayer(object.layer, this.layer);
            const collidableNpc =
                object.__type === ObjectType.Npc &&
                object !== this &&
                !object.dead &&
                object.collidable &&
                util.sameLayer(object.layer, this.layer);
            if (!collidableObstacle && !collidableNpc) continue;

            const collision = collider.intersectCircle(object.collider, this.pos, rad);
            if (!collision) continue;
            v2.set(
                this.pos,
                v2.add(this.pos, v2.mul(collision.dir, collision.pen + 0.001)),
            );
            this.updateCollider();
        }
    }

    private getSkitterMoveTarget(target: Player) {
        const currentLocation = this.findBuildingAt(this.pos, this.layer);
        const targetLocation = this.findBuildingAt(target.pos, target.layer);

        if (currentLocation?.building === targetLocation?.building) {
            this.clearBuildingNavigation();
            return target.pos;
        }

        const entering = !currentLocation && !!targetLocation;
        const routeLocation = currentLocation ?? targetLocation;
        if (!routeLocation) {
            this.clearBuildingNavigation();
            return target.pos;
        }

        if (
            this.navigationBuilding !== routeLocation.building ||
            this.navigationEntering !== entering ||
            !this.isUsableNavigationDoor(this.navigationDoor, routeLocation.building)
        ) {
            this.navigationBuilding = routeLocation.building;
            this.navigationEntering = entering;
            this.navigationDoor = this.selectNavigationDoor(
                routeLocation.building,
                entering,
            )?.door;
            this.navigationCrossingDoor = false;
        } else if (!this.navigationDoor?.door?.open) {
            const openDoor = this.selectNavigationDoor(
                routeLocation.building,
                entering,
                true,
            );
            if (openDoor) {
                this.navigationDoor = openDoor.door;
                this.navigationCrossingDoor = false;
            }
        }

        const route = this.navigationDoor
            ? this.getDoorRoute(this.navigationDoor, routeLocation.building)
            : undefined;
        if (!route) return target.pos;

        if (entering) {
            if (!this.navigationCrossingDoor) {
                if (v2.distance(this.pos, route.outside) <= skitterDoorwayReach) {
                    this.navigationCrossingDoor = true;
                } else {
                    return this.pathAroundBuilding(this.pos, route.outside, route.bounds)
                        .waypoint;
                }
            }
            return route.inside;
        }

        if (!this.navigationCrossingDoor) {
            if (v2.distance(this.pos, route.inside) <= skitterDoorwayReach) {
                this.navigationCrossingDoor = true;
            } else {
                return route.inside;
            }
        }
        return route.outside;
    }

    private findBuildingAt(pos: Vec2, layer: number): BuildingLocation | undefined {
        for (const building of this.game.map.buildings) {
            if (building.layer !== layer || building.ceilingDead) continue;
            for (const region of building.zoomRegions) {
                if (
                    region.zoomIn &&
                    coldet.testCircleAabb(pos, 0.05, region.zoomIn.min, region.zoomIn.max)
                ) {
                    return { building, region: region.zoomIn };
                }
            }
        }
        return undefined;
    }

    private selectNavigationDoor(
        building: Building,
        entering: boolean,
        openOnly = false,
    ) {
        const routes: DoorRoute[] = [];
        for (const object of building.childObjects) {
            if (
                object.__type !== ObjectType.Obstacle ||
                !this.isUsableNavigationDoor(object, building) ||
                (openOnly && !object.door?.open)
            ) {
                continue;
            }
            const route = this.getDoorRoute(object, building);
            if (route) routes.push(route);
        }
        if (!routes.length) return undefined;

        const exteriorRoutes = routes.filter((route) => route.edgeDistance <= 5);
        const candidates = exteriorRoutes.length ? exteriorRoutes : routes;
        let bestRoute: DoorRoute | undefined;
        let bestScore = Infinity;
        for (const route of candidates) {
            const destination = entering ? route.outside : route.inside;
            const travelDistance = entering
                ? this.pathAroundBuilding(this.pos, destination, route.bounds).distance
                : v2.distance(this.pos, destination);
            const door = route.door.door;
            const closedPenalty = door?.open ? 0 : 8;
            const lockedPenalty = door?.locked || !door?.canUse ? 100 : 0;
            const score = travelDistance + closedPenalty + lockedPenalty;
            if (score < bestScore) {
                bestScore = score;
                bestRoute = route;
            }
        }
        return bestRoute;
    }

    private isUsableNavigationDoor(
        door: Obstacle | undefined,
        building: Building,
    ): door is Obstacle {
        return !!(
            door &&
            !door.dead &&
            !door.destroyed &&
            door.isDoor &&
            door.door &&
            door.collidable &&
            door.parentBuilding === building &&
            util.sameLayer(door.layer, this.layer)
        );
    }

    private getDoorRoute(door: Obstacle, building: Building): DoorRoute | undefined {
        const rad = this.colliderRadius();
        const doorState = door.door;
        if (!doorState) return undefined;
        const doorwayCenter = v2.add(
            doorState.closedPos,
            v2.rotate(
                v2.mul(doorState.hinge, door.scale),
                math.oriToRad(doorState.closedOri),
            ),
        );
        let best:
            | {
                  bounds: AABB;
                  direction: Vec2;
                  edgeDistance: number;
              }
            | undefined;

        for (const region of building.zoomRegions) {
            const bounds = region.zoomIn;
            if (!bounds) continue;

            const edges = [
                {
                    distance: Math.abs(doorwayCenter.x - bounds.min.x),
                    direction: v2.create(-1, 0),
                },
                {
                    distance: Math.abs(bounds.max.x - doorwayCenter.x),
                    direction: v2.create(1, 0),
                },
                {
                    distance: Math.abs(doorwayCenter.y - bounds.min.y),
                    direction: v2.create(0, -1),
                },
                {
                    distance: Math.abs(bounds.max.y - doorwayCenter.y),
                    direction: v2.create(0, 1),
                },
            ];
            const edge = edges.reduce((closest, candidate) =>
                candidate.distance < closest.distance ? candidate : closest,
            );
            if (!best || edge.distance < best.edgeDistance) {
                best = {
                    bounds,
                    direction: edge.direction,
                    edgeDistance: edge.distance,
                };
            }
        }
        if (!best) return undefined;

        const crossingOffset = rad + skitterDoorwayOffset;
        return {
            door,
            bounds: collider.createAabb(
                v2.sub(best.bounds.min, v2.create(crossingOffset)),
                v2.add(best.bounds.max, v2.create(crossingOffset)),
            ),
            outside: v2.add(
                doorwayCenter,
                v2.mul(best.direction, best.edgeDistance + crossingOffset),
            ),
            inside: v2.sub(doorwayCenter, v2.mul(best.direction, crossingOffset)),
            edgeDistance: best.edgeDistance,
        };
    }

    private pathAroundBuilding(start: Vec2, end: Vec2, bounds: AABB) {
        const directDistance = v2.distance(start, end);
        if (!this.segmentCrossesAabbInterior(start, end, bounds)) {
            return { waypoint: end, distance: directDistance };
        }

        const nodes = [
            start,
            v2.create(bounds.min.x, bounds.min.y),
            v2.create(bounds.max.x, bounds.min.y),
            v2.create(bounds.max.x, bounds.max.y),
            v2.create(bounds.min.x, bounds.max.y),
            end,
        ];
        const distances = nodes.map(() => Infinity);
        const previous = nodes.map(() => -1);
        const visited = nodes.map(() => false);
        distances[0] = 0;

        for (let step = 0; step < nodes.length; step++) {
            let current = -1;
            for (let i = 0; i < nodes.length; i++) {
                if (
                    !visited[i] &&
                    (current === -1 || distances[i] < distances[current])
                ) {
                    current = i;
                }
            }
            if (current === -1 || distances[current] === Infinity) break;
            visited[current] = true;

            for (let next = 0; next < nodes.length; next++) {
                if (
                    next === current ||
                    visited[next] ||
                    this.segmentCrossesAabbInterior(nodes[current], nodes[next], bounds)
                ) {
                    continue;
                }
                const distance =
                    distances[current] + v2.distance(nodes[current], nodes[next]);
                if (distance < distances[next]) {
                    distances[next] = distance;
                    previous[next] = current;
                }
            }
        }

        const endIndex = nodes.length - 1;
        if (distances[endIndex] === Infinity) {
            return { waypoint: end, distance: directDistance };
        }

        let waypointIndex = endIndex;
        while (previous[waypointIndex] > 0) {
            waypointIndex = previous[waypointIndex];
        }
        return {
            waypoint: nodes[waypointIndex],
            distance: distances[endIndex],
        };
    }

    private segmentCrossesAabbInterior(start: Vec2, end: Vec2, bounds: AABB) {
        const epsilon = 0.05;
        return !!coldet.intersectSegmentAabb(
            start,
            end,
            v2.add(bounds.min, v2.create(epsilon)),
            v2.sub(bounds.max, v2.create(epsilon)),
        );
    }

    private clearBuildingNavigation() {
        this.navigationBuilding = undefined;
        this.navigationDoor = undefined;
        this.navigationCrossingDoor = false;
    }

    private colliderRadius() {
        const collision = NpcDefs[this.type].collision;
        return collision.type === collider.Type.Circle ? collision.rad * this.scale : 1;
    }

    private updateCollider() {
        const def = NpcDefs[this.type];
        this.collider = collider.transform(def.collision, this.pos, this.ori, this.scale);
    }

    private setState(state: string) {
        if (state === this.state) return;
        this.state = state;
        this.setPartDirty();
    }

    override damage(params: DamageParams) {
        if (!this.destructible || this.dead) return;
        this.health -= params.amount ?? 0;
        this.healthT = Math.max(this.health / this.maxHealth, 0);
        if (this.health <= 0) {
            this.dead = true;
            this.state = "dead";
            if (this.type === "skitter") {
                this.game.npcBarn.scheduleSkitterRespawn();
            }
        }
        this.setDirty();
    }
}
