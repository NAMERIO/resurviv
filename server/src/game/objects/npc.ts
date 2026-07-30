import { GameObjectDefs } from "../../../../shared/defs/gameObjectDefs";
import type { ThrowableDef } from "../../../../shared/defs/gameObjects/throwableDefs";
import { type NpcDef, NpcDefs } from "../../../../shared/defs/npcDefs";
import { getVehicleGear } from "../../../../shared/defs/vehicleDefs";
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
const secondStageAttackInterval = 15;
const cannonChargeTime = 2;
const cannonRange = GameConfig.scopeZoomRadius.desktop["2xscope"];
const skitterDamage = 5;
const skitterDoorwayOffset = 0.75;
const skitterDoorwayReach = 0.75;
const maxLivingSkitters = 10;
const motherShipPatrolAngularSpeed = 0.02;
const motherShipPatrolRadialSpeed = 0.045;
const motherShipPatrolMaxRadius = 32;
const motherShipPatrolMinRadius = 6;
const vehicleReverseEngageDelay = 0.15;

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
            this.getLivingSkitterCount() >= maxLivingSkitters
        ) {
            return undefined;
        }

        const npc = new Npc(this.game, type, pos, layer);
        this.npcs.push(npc);
        this.game.objectRegister.register(npc);
        return npc;
    }

    update(dt: number) {
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

    getLivingSkitterCount() {
        return this.npcs.reduce(
            (count, npc) =>
                count + (npc.type === "skitter" && !npc.dead && !npc.destroyed ? 1 : 0),
            0,
        );
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
    speed = 0;
    driftIntensity = 0;
    travelDir = v2.create(1, 0);
    steering = 0;
    gear = 0;
    shiftTicker = 0;
    reverseEngageTicker = 0;
    handbrakeEngaged = false;
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
    driver?: Player;

    private attackTicker = 0;
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
        this.attackTicker = def.attackInterval ?? 0;
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
        } else if (NpcDefs[this.type].vehicle && !this.driver) {
            this.applyVehicleDrag(dt);
        }
    }

    drive(
        dt: number,
        input: {
            accelerate: boolean;
            brake: boolean;
            steerLeft: boolean;
            steerRight: boolean;
            handbrake: boolean;
        },
    ) {
        const vehicle = NpcDefs[this.type].vehicle;
        if (!vehicle || !this.driver) return v2.create(0, 0);

        this.shiftTicker = math.max(0, this.shiftTicker - dt);
        const currentGear = getVehicleGear(vehicle, math.max(this.speed, 0));
        if (currentGear > this.gear && this.gear > 0) {
            this.shiftTicker = vehicle.transmission.shiftDuration;
        }
        this.gear = currentGear;

        if (input.accelerate) {
            this.reverseEngageTicker = 0;
            const speedT = math.clamp(this.speed / vehicle.maxForwardSpeed, 0, 1);
            const accelerationTaper = math.lerp(
                speedT,
                1,
                vehicle.transmission.highSpeedAccelerationMultiplier,
            );
            const shiftMultiplier =
                this.shiftTicker > 0
                    ? vehicle.transmission.shiftAccelerationMultiplier
                    : 1;
            this.speed =
                this.speed < 0
                    ? math.min(0, this.speed + vehicle.braking * dt)
                    : math.min(
                          this.speed +
                              vehicle.acceleration *
                                  accelerationTaper *
                                  shiftMultiplier *
                                  dt,
                          vehicle.maxForwardSpeed,
                      );
        } else if (input.brake) {
            if (this.speed > 0) {
                // S is the brake while moving forward and cannot skip through zero.
                this.speed = math.max(0, this.speed - vehicle.braking * dt);
                this.reverseEngageTicker = 0;
            } else {
                const previousReverseTime = math.max(
                    0,
                    this.reverseEngageTicker - vehicleReverseEngageDelay,
                );
                this.reverseEngageTicker += dt;
                const reverseTime =
                    math.max(0, this.reverseEngageTicker - vehicleReverseEngageDelay) -
                    previousReverseTime;
                this.speed = math.max(
                    this.speed - vehicle.acceleration * reverseTime,
                    -vehicle.maxReverseSpeed,
                );
            }
        } else {
            this.reverseEngageTicker = 0;
            this.applyVehicleDrag(dt);
        }
        if (input.handbrake && !this.handbrakeEngaged) {
            const handbrakeSpeedLoss = vehicle.drift.handbrakeEntrySpeedLoss;
            this.speed =
                Math.abs(this.speed) <= handbrakeSpeedLoss
                    ? 0
                    : this.speed - math.sign(this.speed) * handbrakeSpeedLoss;
        }
        this.handbrakeEngaged = input.handbrake;

        const steerInput = Number(input.steerLeft) - Number(input.steerRight);
        const steeringRate =
            steerInput === 0
                ? vehicle.handling.steeringReturn
                : vehicle.handling.steeringResponse;
        this.steering += math.clamp(
            steerInput - this.steering,
            -steeringRate * dt,
            steeringRate * dt,
        );

        if (Math.abs(this.speed) > 0.15 && Math.abs(this.steering) > 0.001) {
            const speedT = math.clamp(
                Math.abs(this.speed) / vehicle.maxForwardSpeed,
                0,
                1,
            );
            const maxSteerAngle = math.lerp(
                speedT,
                vehicle.handling.lowSpeedSteerAngle,
                vehicle.handling.highSpeedSteerAngle,
            );
            const steerAngle = this.steering * maxSteerAngle;
            const yawRate =
                (this.speed / vehicle.handling.wheelBase) * Math.tan(steerAngle);
            const driftTurnMultiplier = input.handbrake
                ? vehicle.drift.handbrakeTurnMultiplier
                : 1;
            this.ori += yawRate * driftTurnMultiplier * dt;
            this.ori = math.fmod(this.ori + Math.PI, Math.PI * 2) - Math.PI;
        }

        const direction = v2.mul(
            v2.create(Math.cos(this.ori), Math.sin(this.ori)),
            math.sign(this.speed || 1),
        );
        if (Math.abs(this.speed) <= 0.15) {
            this.travelDir = v2.copy(direction);
            this.driftIntensity = 0;
        } else {
            const traction = input.handbrake
                ? vehicle.drift.handbrakeTraction
                : math.max(
                      vehicle.drift.recoveryTraction,
                      vehicle.handling.corneringGrip * (1 - this.driftIntensity * 0.35),
                  );
            const tractionT = 1 - Math.exp(-traction * dt);
            this.travelDir = v2.normalizeSafe(
                v2.lerp(tractionT, this.travelDir, direction),
                direction,
            );
            const slipAngle = Math.acos(
                math.clamp(v2.dot(this.travelDir, direction), -1, 1),
            );
            const slipIntensity = math.clamp(slipAngle / (Math.PI * 0.3), 0, 1);
            const handbrakeSmoke =
                input.handbrake && Math.abs(this.speed) >= vehicle.drift.minSpeed
                    ? 0.3
                    : 0;
            this.driftIntensity = math.max(slipIntensity, handbrakeSmoke);
        }

        this.setPartDirty();
        return v2.copy(this.travelDir);
    }

    private applyVehicleDrag(dt: number) {
        const vehicle = NpcDefs[this.type].vehicle;
        if (!vehicle || this.speed === 0) return;
        const drag = vehicle.coastingDrag * dt;
        this.speed =
            Math.abs(this.speed) <= drag ? 0 : this.speed - math.sign(this.speed) * drag;
        this.driftIntensity = math.max(0, this.driftIntensity - dt * 2.5);
        this.setPartDirty();
    }

    interact(player: Player) {
        const vehicle = NpcDefs[this.type].vehicle;
        if (!vehicle || this.dead) return;

        if (this.driver === player) {
            this.dismount(player);
            return;
        }
        if (this.driver || player.vehicle || player.dead || player.downed) return;

        this.driver = player;
        player.vehicle = this;
        player.cancelAction();
        player.weaponManager.cancelVehicleCombat();
        v2.set(player.pos, this.pos);
        this.speed = 0;
        this.driftIntensity = 0;
        this.travelDir = v2.create(Math.cos(this.ori), Math.sin(this.ori));
        this.steering = 0;
        this.gear = 0;
        this.shiftTicker = 0;
        this.reverseEngageTicker = 0;
        this.handbrakeEngaged = false;
        this.setState("drive");
        player.setPartDirty();
        player.game.grid.updateObject(player);
    }

    dismount(player: Player, reposition = true) {
        if (this.driver !== player) return;

        this.driver = undefined;
        player.vehicle = undefined;
        player.vehicleBrake = false;
        this.speed = 0;
        this.driftIntensity = 0;
        this.steering = 0;
        this.gear = 0;
        this.shiftTicker = 0;
        this.reverseEngageTicker = 0;
        this.handbrakeEngaged = false;
        this.setState("idle");
        this.setPartDirty();

        if (reposition) {
            const exitDir = v2.create(-Math.sin(this.ori), Math.cos(this.ori));
            v2.set(
                player.pos,
                v2.add(
                    this.pos,
                    v2.mul(exitDir, this.collisionRadius() + player.rad + 0.5),
                ),
            );
            player.game.map.clampToMapBounds(player.pos, player.rad);
            player.setPartDirty();
            player.game.grid.updateObject(player);
        }
    }

    syncToDriver(pos: Vec2) {
        if (!this.driver) return;
        v2.set(this.pos, pos);
        this.updateCollider();
        this.setPartDirty();
        this.game.grid.updateObject(this);
    }

    syncDrivenCollider(pos: Vec2) {
        if (!this.driver) return;
        v2.set(this.pos, pos);
        this.updateCollider();
    }

    breakObstacleOnImpact(obstacle: Obstacle) {
        const vehicle = NpcDefs[this.type].vehicle;
        if (
            !vehicle ||
            !this.driver ||
            obstacle.dead ||
            !obstacle.destructible ||
            Math.abs(this.speed) < vehicle.impact.minBreakSpeed
        ) {
            return false;
        }

        obstacle.damage({
            amount: obstacle.health,
            damageType: GameConfig.DamageType.Npc,
            dir: v2.copy(this.travelDir),
            mapSourceType: this.type,
            source: this.driver,
            sourceTeamId: this.driver.teamId,
        });
        return obstacle.dead;
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
                    if (this.cannonProjectile) {
                        this.spawnSkitters(def);
                    } else {
                        this.clearCannonMarker();
                    }
                }
            }
        }

        if (this.cannonReady && !this.cannonTarget && !this.cannonProjectile) {
            this.acquireCannonTarget();
        }

        if (this.game.playerBarn.livingPlayers.length === 0) return;

        this.attackTicker -= dt;
        if (this.attackTicker > 0) return;

        this.attackTicker = this.enteredSecondStage
            ? secondStageAttackInterval
            : (def.attackInterval ?? 25);
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
        if (distance <= this.collisionRadius() + target.rad + 0.25) {
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
            if (
                player.dead ||
                player.downed ||
                !util.sameLayer(player.layer, this.layer)
            ) {
                continue;
            }
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
        const rad = this.collisionRadius();
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
        const rad = this.collisionRadius();
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

    collisionRadius() {
        const collision = NpcDefs[this.type].collision;
        if (collision.type === collider.Type.Circle) {
            return collision.rad * this.scale;
        }
        if (collision.type === collider.Type.Polygon) {
            return (
                Math.max(...collision.points.map((point) => v2.length(point))) *
                this.scale
            );
        }
        return (
            Math.max(
                Math.abs(collision.min.x),
                Math.abs(collision.min.y),
                Math.abs(collision.max.x),
                Math.abs(collision.max.y),
            ) * this.scale
        );
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
        }
        this.setDirty();
    }
}
