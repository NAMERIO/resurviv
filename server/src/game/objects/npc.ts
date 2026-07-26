import { GameObjectDefs } from "../../../../shared/defs/gameObjectDefs";
import type { ThrowableDef } from "../../../../shared/defs/gameObjects/throwableDefs";
import { type NpcDef, NpcDefs } from "../../../../shared/defs/npcDefs";
import { GameConfig } from "../../../../shared/gameConfig";
import { ObjectType } from "../../../../shared/net/objectSerializeFns";
import { type AABB, type Collider, coldet } from "../../../../shared/utils/coldet";
import { collider } from "../../../../shared/utils/collider";
import { util } from "../../../../shared/utils/util";
import { type Vec2, v2 } from "../../../../shared/utils/v2";
import type { Game } from "../game";
import { BaseGameObject, type DamageParams } from "./gameObject";
import type { MapIndicator } from "./mapIndicator";
import type { Player } from "./player";
import type { Projectile } from "./projectile";

const spriteUnitsPerGameUnit = 16;
const secondStageTime = 4 * 60;
const secondStageSpawnInterval = 15;
const cannonChargeTime = 2;
const cannonRange = GameConfig.scopeZoomRadius.desktop["2xscope"];
const skitterDamage = 5;

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

    addNpc(type: string, pos: Vec2, layer = 0) {
        const npc = new Npc(this.game, type, pos, layer);
        this.npcs.push(npc);
        this.game.objectRegister.register(npc);
        return npc;
    }

    update(dt: number) {
        if (!this.game.started) return;

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
    private mapIndicator?: MapIndicator;

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
            (npc) => npc.type === "motherShip" && !npc.dead,
        );
        if (motherShips.length <= 1) return this.game.gas.posNew;

        const index = motherShips.indexOf(this);
        const spacing = this.colliderRadius() * 2 + 2;
        const formationRadius = spacing / (2 * Math.sin(Math.PI / motherShips.length));
        const angle = (index / motherShips.length) * Math.PI * 2;
        return v2.add(
            this.game.gas.posNew,
            v2.create(
                Math.cos(angle) * formationRadius,
                Math.sin(angle) * formationRadius,
            ),
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
        if (!target || target.indoors) return;

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

        this.ori = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);
        this.moveToward(target.pos, NpcDefs.skitter.movementSpeed, dt, true);
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
        const oldPos = v2.copy(this.pos);
        const nextPos = v2.add(this.pos, movement);

        if (collide && this.isInsideBuilding(nextPos)) return;
        v2.set(this.pos, nextPos);
        this.updateCollider();

        if (collide) {
            this.resolveCollisions();
            if (this.isInsideBuilding(this.pos)) {
                v2.set(this.pos, oldPos);
                this.updateCollider();
                return;
            }
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

    private isInsideBuilding(pos: Vec2) {
        const rad = this.colliderRadius();
        for (const building of this.game.map.buildings) {
            if (building.layer !== this.layer) continue;
            for (const region of building.zoomRegions) {
                if (
                    region.zoomIn &&
                    coldet.testCircleAabb(pos, rad, region.zoomIn.min, region.zoomIn.max)
                ) {
                    return true;
                }
            }
        }
        return false;
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
        }
        this.setDirty();
    }
}
