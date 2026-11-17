import { MapObjectDefs } from "../../shared/defs/mapObjectDefs";
import type { ObstacleDef } from "../../shared/defs/mapObjectsTyping";
import { NpcDefs } from "../../shared/defs/npcDefs";
import { GameConfig, Input } from "../../shared/gameConfig";
import { getInputMoveDir, type InputMsg } from "../../shared/net/inputMsg";
import {
    type PredictionData,
    PredictionFireMode,
    type PredictionGunData,
    PredictionLimits,
} from "../../shared/net/updateMsg";
import { type AABB, type Collider, coldet } from "../../shared/utils/coldet";
import { collider } from "../../shared/utils/collider";
import { math } from "../../shared/utils/math";
import { util } from "../../shared/utils/util";
import { type Vec2, v2 } from "../../shared/utils/v2";
import type { Npc } from "./objects/npc";
import type { Obstacle } from "./objects/obstacle";
import type { Structure } from "./objects/structure";

const SERVER_TICK = 1 / 100;
const SNAP_DIST = 4;
const SMOOTH_TIME = 0.07;
const MAX_PENDING_TIME = 2.5;
const FRAME_KEEP_TIME = 0.5;
const MAX_INPUTS = 4096;
const BROADPHASE_MARGIN = 2;
const CORRECTION_EPSILON = 0.05;
const SINGLE_BUFFER_TIME = 0.1;
const MAX_CATCHUP_TICKS = 10;
const MIN_TICK = 1 / 250;
const MAX_TICK = 1 / 20;

const GUN_BLOCKING_INPUTS = new Set<Input>([
    Input.Reload,
    Input.Cancel,
    Input.Interact,
    Input.Revive,
    Input.Use,
    Input.Loot,
    Input.EquipPrimary,
    Input.EquipSecondary,
    Input.EquipMelee,
    Input.EquipThrowable,
    Input.EquipFragGrenade,
    Input.EquipSmokeGrenade,
    Input.EquipNextWeap,
    Input.EquipPrevWeap,
    Input.EquipLastWeap,
    Input.EquipOtherGun,
    Input.UseBandage,
    Input.UseHealthKit,
    Input.UseSoda,
    Input.UsePainkiller,
    Input.UseNitroLace,
    Input.StowWeapons,
    Input.SwapWeapSlots,
    Input.ActivateStreak,
]);

interface SentInput {
    seq: number;
    id: number;
    move: Vec2;
    moveTime: number;
    shootStart: boolean;
    shootHold: boolean;
    gunBlock: boolean;
}

interface Frame {
    seq: number;
    time: number;
    dt: number;
}

interface GunSim {
    mode: PredictionFireMode;
    cooldown: number;
    fireCooldown: number;
    slowdownTime: number;
    burstCount: number;
    burstDelay: number;
    bursts: number[];
    ammo: number;
    pendingStart: boolean;
}

interface SimState {
    pos: Vec2;
    layer: number;
    slowdown: number;
    gun: GunSim | null;
    lastSeq: number;
    nextTick: number;
    tickDt: number;
    openedDoors: Set<Obstacle>;
}

interface SimEnv {
    obstacles: Obstacle[];
    autoDoors: Obstacle[];
    npcs: Npc[];
    structures: Structure[];
    rad: number;
    mapWidth: number;
    mapHeight: number;
    checkWater: boolean;
    isOnWater: (pos: Vec2, layer: number) => boolean;
}

export interface PredictionWorld {
    obstacles: Obstacle[];
    npcs: Npc[];
    structures: Structure[];
    mapWidth: number;
    mapHeight: number;
    isOnWater: (pos: Vec2, layer: number) => boolean;
}

export interface PredictionTarget {
    serverPos: Vec2;
    serverLayer: number;
    rad: number;
    visualPos: Vec2;
}

export interface PredictionStats {
    correctionsPerSec: number;
    avgCorrection: number;
    maxCorrection: number;
    snapsPerSec: number;
    pendingMs: number;
}

export function getPredictionRadius(scale: number) {
    return scale * GameConfig.player.radius;
}

function cloneGun(gun: PredictionGunData | null): GunSim | null {
    if (!gun || gun.mode === PredictionFireMode.None) return null;
    return {
        mode: gun.mode,
        cooldown: gun.cooldown,
        fireCooldown: gun.fireCooldown,
        slowdownTime: gun.slowdownTime,
        burstCount: gun.burstCount,
        burstDelay: gun.burstDelay,
        bursts: gun.bursts.slice(),
        ammo: gun.ammo,
        pendingStart: gun.buffered,
    };
}

function isGunBlocking(msg: InputMsg) {
    if (msg.useItem || msg.streakIdx >= 0) return true;
    for (let i = 0; i < msg.inputs.length; i++) {
        if (GUN_BLOCKING_INPUTS.has(msg.inputs[i])) return true;
    }
    return false;
}

function doorOpensFor(obstacle: Obstacle, pos: Vec2) {
    const door = obstacle.door;
    if (!obstacle.isDoor || !door) return false;
    if (!door.autoOpen || door.open || door.locked || door.canUse === false) return false;
    const def = MapObjectDefs[obstacle.type] as ObstacleDef;
    if ((def.door?.openDelay ?? 0) > 0) return false;
    const openOneWay = Number(door.openOneWay) || 0;
    if (openOneWay) {
        const toDoor = v2.sub(obstacle.pos, pos);
        const doorDir = v2.rotate(v2.create(1, 0), obstacle.rot);
        const side = v2.dot(toDoor, doorDir) < 0 ? -1 : 1;
        if (side !== openOneWay) return false;
    }
    return true;
}

export class LocalPrediction {
    active = false;
    offset = v2.create(0, 0);

    private state: SimState = LocalPrediction.emptyState();
    private clock = 0;
    private serverData: PredictionData | null = null;
    private ackSeq = -1;
    private lastOutput: Vec2 | null = null;
    private releaseOffset = v2.create(0, 0);
    private inputs: SentInput[] = [];
    private frames: Frame[] = [];
    private nextSeq = 0;
    private lastInputId = 0;
    private aabbCache = new WeakMap<Collider, AABB>();

    private statTicker = 0;
    private statCorrections = 0;
    private statCorrectionSum = 0;
    private statCorrectionMax = 0;
    private statSnaps = 0;
    stats: PredictionStats = {
        correctionsPerSec: 0,
        avgCorrection: 0,
        maxCorrection: 0,
        snapsPerSec: 0,
        pendingMs: 0,
    };

    private static emptyState(): SimState {
        return {
            pos: v2.create(0, 0),
            layer: 0,
            slowdown: 0,
            gun: null,
            lastSeq: -1,
            nextTick: 0,
            tickDt: SERVER_TICK,
            openedDoors: new Set(),
        };
    }

    get pos() {
        return this.state.pos;
    }

    get layer() {
        return this.state.layer;
    }

    reset() {
        this.active = false;
        this.state = LocalPrediction.emptyState();
        this.serverData = null;
        this.ackSeq = -1;
        this.lastOutput = null;
        this.inputs.length = 0;
        this.frames.length = 0;
        this.offset = v2.create(0, 0);
        this.releaseOffset = v2.create(0, 0);
    }

    nextInputId() {
        this.lastInputId = (this.lastInputId + 1) & 0xffff;
        return this.lastInputId;
    }

    onInputSent(msg: InputMsg) {
        const move = getInputMoveDir(msg);
        const prev = this.inputs[this.inputs.length - 1];
        const sameMove = prev && prev.move.x === move.x && prev.move.y === move.y;
        this.inputs.push({
            seq: this.nextSeq++,
            id: msg.inputId,
            move,
            moveTime: sameMove ? prev.moveTime : this.clock,
            shootStart: msg.shootStart,
            shootHold: msg.shootHold,
            gunBlock: isGunBlocking(msg),
        });
        if (this.inputs.length > MAX_INPUTS) {
            this.inputs.splice(0, this.inputs.length - MAX_INPUTS);
            const firstSeq = this.inputs[0].seq;
            let drop = 0;
            while (drop < this.frames.length && this.frames[drop].seq < firstSeq) drop++;
            if (drop > 0) this.frames.splice(0, drop);
        }
    }

    update(
        dt: number,
        enabled: boolean,
        target: PredictionTarget | null,
        world: PredictionWorld,
    ): Vec2 | null {
        this.clock += dt;
        this.updateStats(dt);

        const data = this.serverData;
        if (!enabled || !target || !data || !this.inputs.length || world.mapWidth <= 0) {
            return this.release(dt, target);
        }

        const input = this.inputs[this.inputs.length - 1];

        if (!this.active) {
            this.active = true;
            this.frames.length = 0;
            this.state = this.serverState(target, data, input.seq, this.clock - dt);
            const shown = v2.add(target.visualPos, this.releaseOffset);
            const offset = v2.sub(shown, this.state.pos);
            this.offset = v2.length(offset) < SNAP_DIST ? offset : v2.create(0, 0);
            this.releaseOffset = v2.create(0, 0);
        }

        const frame: Frame = { seq: input.seq, time: this.clock - dt, dt };
        this.frames.push(frame);

        if (this.clock - this.frames[0].time > MAX_PENDING_TIME) {
            this.frames.length = 0;
            this.state = this.serverState(target, data, input.seq, this.clock - dt);
        } else {
            const env = this.buildEnv(
                world,
                this.state.pos,
                target.rad,
                this.maxSpeed(data) * dt,
                data,
            );
            this.runFrame(this.state, input, frame.time, frame.time + dt, data, env);
        }

        this.offset = v2.mul(this.offset, Math.exp(-dt / SMOOTH_TIME));
        if (v2.lengthSqr(this.offset) < 1e-8) {
            this.offset = v2.create(0, 0);
        }

        const output = v2.add(this.state.pos, this.offset);
        this.lastOutput = v2.copy(output);
        return output;
    }

    onServerUpdate(
        data: PredictionData | null | undefined,
        target: PredictionTarget | null,
        world: PredictionWorld,
    ) {
        this.serverData = data ?? null;
        if (!data) return;

        const ackIdx = this.findInputIdx(data.inputId);
        if (ackIdx >= 0) this.ackSeq = this.inputs[ackIdx].seq;
        if (!this.active || !target) return;

        const lastSeq = this.inputs.length ? this.inputs[this.inputs.length - 1].seq : -1;
        let state: SimState;

        if (ackIdx < 0) {
            state = this.serverState(target, data, lastSeq, this.clock);
            this.frames.length = 0;
            this.stats.pendingMs = 0;
        } else {
            const ack = this.inputs[ackIdx];
            const cut =
                ack.moveTime + Math.max(data.moveAge, PredictionLimits.minMoveAge);
            state = this.serverState(target, data, ack.seq, cut);

            let drop = 0;
            while (
                drop < this.frames.length &&
                this.frames[drop].time + this.frames[drop].dt < cut - FRAME_KEEP_TIME
            ) {
                drop++;
            }
            if (drop > 0) this.frames.splice(0, drop);

            const keepSeq = this.frames.length
                ? Math.min(this.frames[0].seq, ack.seq)
                : ack.seq;
            let dropInputs = 0;
            while (
                dropInputs < this.inputs.length - 1 &&
                this.inputs[dropInputs].seq < keepSeq
            ) {
                dropInputs++;
            }
            if (dropInputs > 0) this.inputs.splice(0, dropInputs);

            let replayTime = 0;
            for (let i = 0; i < this.frames.length; i++) {
                const frame = this.frames[i];
                const start = Math.max(frame.time, cut);
                const end = frame.time + frame.dt;
                if (end > start) replayTime += end - start;
            }

            if (replayTime > 0) {
                const env = this.buildEnv(
                    world,
                    state.pos,
                    target.rad,
                    this.maxSpeed(data) * replayTime,
                    data,
                );
                const firstSeq = this.inputs[0].seq;
                for (let i = 0; i < this.frames.length; i++) {
                    const frame = this.frames[i];
                    const start = Math.max(frame.time, cut);
                    const end = frame.time + frame.dt;
                    if (end <= start) continue;
                    const input = this.inputs[frame.seq - firstSeq];
                    if (!input) continue;
                    this.runFrame(state, input, start, end, data, env);
                }
            }
            this.stats.pendingMs = replayTime * 1000;
        }

        const delta = v2.sub(this.state.pos, state.pos);
        const error = v2.length(delta);
        if (error > SNAP_DIST) {
            this.offset = v2.create(0, 0);
            this.statSnaps++;
        } else {
            this.offset = v2.add(this.offset, delta);
            if (v2.length(this.offset) > SNAP_DIST) {
                this.offset = v2.create(0, 0);
            }
        }
        if (error > CORRECTION_EPSILON) {
            this.statCorrections++;
            this.statCorrectionSum += error;
            this.statCorrectionMax = Math.max(this.statCorrectionMax, error);
        }

        this.state = state;
    }

    private serverState(
        target: PredictionTarget,
        data: PredictionData,
        lastSeq: number,
        tickTime: number,
    ): SimState {
        const tickDt = math.clamp(data.tickInterval || SERVER_TICK, MIN_TICK, MAX_TICK);
        return {
            pos: v2.copy(target.serverPos),
            layer: target.serverLayer,
            slowdown: data.slowdownLeft,
            gun: cloneGun(data.gun),
            lastSeq,
            nextTick: tickTime + tickDt,
            tickDt,
            openedDoors: new Set(),
        };
    }

    private maxSpeed(data: PredictionData) {
        return Math.max(
            data.speed,
            data.shootSpeed,
            data.waterSpeed,
            data.waterShootSpeed,
        );
    }

    private release(dt: number, target: PredictionTarget | null): Vec2 | null {
        if (this.active && target && this.lastOutput) {
            const offset = v2.sub(this.lastOutput, target.visualPos);
            this.releaseOffset = v2.length(offset) < SNAP_DIST ? offset : v2.create(0, 0);
        }
        this.active = false;
        this.lastOutput = null;

        if (!target) {
            this.releaseOffset = v2.create(0, 0);
            return null;
        }
        this.releaseOffset = v2.mul(this.releaseOffset, Math.exp(-dt / SMOOTH_TIME));
        if (v2.lengthSqr(this.releaseOffset) < 1e-8) {
            this.releaseOffset = v2.create(0, 0);
            return null;
        }
        return v2.add(target.visualPos, this.releaseOffset);
    }

    private runFrame(
        state: SimState,
        input: SentInput,
        start: number,
        end: number,
        data: PredictionData,
        env: SimEnv,
    ) {
        if (input.seq !== state.lastSeq) {
            if (input.seq > this.ackSeq) {
                if (input.gunBlock) {
                    state.gun = null;
                } else if (input.shootStart && state.gun) {
                    state.gun.pendingStart = true;
                }
            }
            state.lastSeq = input.seq;
        }

        if (state.nextTick <= start - MAX_CATCHUP_TICKS * state.tickDt) {
            state.nextTick = start + state.tickDt;
        }
        while (state.nextTick <= start) {
            this.tick(state, input.shootHold);
        }

        let time = start;
        while (time < end) {
            const pieceEnd = Math.min(end, state.nextTick);
            if (pieceEnd > time) {
                this.movePiece(state, input.move, pieceEnd - time, data, env);
                time = pieceEnd;
            }
            if (time >= state.nextTick) {
                this.tick(state, input.shootHold);
            }
        }
    }

    private tick(state: SimState, hold: boolean) {
        this.updateGun(state, hold, state.tickDt);
        state.slowdown = Math.max(0, state.slowdown - state.tickDt);
        state.nextTick += state.tickDt;
    }

    private movePiece(
        state: SimState,
        move: Vec2,
        dt: number,
        data: PredictionData,
        env: SimEnv,
    ) {
        const slowed = state.slowdown > 0;
        const onWater = env.checkWater && env.isOnWater(state.pos, state.layer);
        const speed = onWater
            ? slowed
                ? data.waterShootSpeed
                : data.waterSpeed
            : slowed
              ? data.shootSpeed
              : data.speed;

        this.move(state, move, dt, speed, env);
    }

    private updateGun(state: SimState, hold: boolean, dt: number) {
        const gun = state.gun;
        if (!gun) return;

        gun.cooldown -= dt;

        switch (gun.mode) {
            case PredictionFireMode.Auto:
                gun.pendingStart = false;
                if (hold && gun.cooldown <= 0) this.fire(state, gun);
                break;
            case PredictionFireMode.Single:
                if (gun.pendingStart) {
                    if (gun.cooldown < 0) {
                        this.fire(state, gun);
                        gun.pendingStart = false;
                    } else if (gun.cooldown >= SINGLE_BUFFER_TIME) {
                        gun.pendingStart = false;
                    }
                }
                break;
            case PredictionFireMode.Burst:
                gun.pendingStart = false;
                if (hold && gun.cooldown < 0) {
                    gun.cooldown = 0;
                    for (let i = 0; i < gun.burstCount; i++) {
                        gun.bursts.push(gun.cooldown);
                        gun.cooldown += gun.burstDelay;
                    }
                    gun.cooldown += gun.slowdownTime;
                }
                for (let i = 0; i < gun.bursts.length; i++) {
                    gun.bursts[i] -= dt;
                    if (gun.bursts[i] <= 0) {
                        this.fire(state, gun);
                        gun.bursts.splice(i, 1);
                        i--;
                    }
                }
                break;
        }
    }

    private fire(state: SimState, gun: GunSim) {
        if (gun.ammo <= 0) return;
        gun.cooldown = gun.fireCooldown;
        gun.ammo--;
        state.slowdown = gun.slowdownTime;
    }

    private findInputIdx(id: number) {
        for (let i = this.inputs.length - 1; i >= 0; i--) {
            if (this.inputs[i].id === id) return i;
        }
        return -1;
    }

    private getAabb(col: Collider) {
        let aabb = this.aabbCache.get(col);
        if (!aabb) {
            aabb = collider.toAabb(col);
            this.aabbCache.set(col, aabb);
        }
        return aabb;
    }

    private buildEnv(
        world: PredictionWorld,
        center: Vec2,
        rad: number,
        travel: number,
        data: PredictionData,
    ): SimEnv {
        const range = rad + travel + BROADPHASE_MARGIN;

        const obstacles: Obstacle[] = [];
        const autoDoors: Obstacle[] = [];
        for (let i = 0; i < world.obstacles.length; i++) {
            const obstacle = world.obstacles[i];
            if (!obstacle.active || obstacle.dead || !obstacle.collidable) continue;
            if (!obstacle.collider) continue;
            if (
                data.treeClimbing &&
                (MapObjectDefs[obstacle.type] as ObstacleDef).isTree
            ) {
                continue;
            }
            const aabb = this.getAabb(obstacle.collider);
            if (!coldet.testCircleAabb(center, range, aabb.min, aabb.max)) continue;
            obstacles.push(obstacle);
            if (obstacle.isDoor && obstacle.door?.autoOpen && !obstacle.door.open) {
                autoDoors.push(obstacle);
            }
        }

        const npcs: Npc[] = [];
        for (let i = 0; i < world.npcs.length; i++) {
            const npc = world.npcs[i];
            if (!npc.active || npc.dead || !npc.collider) continue;
            if (!NpcDefs[npc.type as keyof typeof NpcDefs]?.collidable) continue;
            const aabb = this.getAabb(npc.collider);
            if (!coldet.testCircleAabb(center, range, aabb.min, aabb.max)) continue;
            npcs.push(npc);
        }

        const structures: Structure[] = [];
        for (let i = 0; i < world.structures.length; i++) {
            const structure = world.structures[i];
            if (structure.active && structure.stairs?.length) {
                structures.push(structure);
            }
        }

        return {
            obstacles,
            autoDoors,
            npcs,
            structures,
            rad,
            mapWidth: world.mapWidth,
            mapHeight: world.mapHeight,
            checkWater:
                data.waterSpeed !== data.speed ||
                data.waterShootSpeed !== data.shootSpeed,
            isOnWater: world.isOnWater,
        };
    }

    private move(state: SimState, move: Vec2, dt: number, speed: number, env: SimEnv) {
        const moving = move.x !== 0 || move.y !== 0;
        const moveSpeed = moving ? speed : 0;
        const steps = moving ? Math.round(Math.max(moveSpeed * dt + 5, 5)) : 1;
        const speedToAdd = (moveSpeed / steps) * dt;
        const pos = state.pos;

        for (let i = 0; i < steps; i++) {
            pos.x += move.x * speedToAdd;
            pos.y += move.y * speedToAdd;

            for (let j = 0; j < env.obstacles.length; j++) {
                const obstacle = env.obstacles[j];
                if (!util.sameLayer(obstacle.layer, state.layer)) continue;
                if (state.openedDoors.has(obstacle)) continue;
                const res = collider.intersectCircle(obstacle.collider, pos, env.rad);
                if (res) {
                    pos.x += res.dir.x * (res.pen + 0.001);
                    pos.y += res.dir.y * (res.pen + 0.001);
                }
            }

            for (let j = 0; j < env.npcs.length; j++) {
                const npc = env.npcs[j];
                if (!util.sameLayer(npc.layer, state.layer)) continue;
                const res = collider.intersectCircle(npc.collider, pos, env.rad);
                if (res) {
                    pos.x += res.dir.x * (res.pen + 0.001);
                    pos.y += res.dir.y * (res.pen + 0.001);
                }
            }
        }

        this.updateStairs(state, env);

        pos.x = math.clamp(pos.x, env.rad, env.mapWidth - env.rad);
        pos.y = math.clamp(pos.y, env.rad, env.mapHeight - env.rad);

        this.updateAutoDoors(state, env);
    }

    private updateAutoDoors(state: SimState, env: SimEnv) {
        for (let i = 0; i < env.autoDoors.length; i++) {
            const door = env.autoDoors[i];
            if (state.openedDoors.has(door)) continue;
            if (!util.sameLayer(door.layer, state.layer)) continue;
            if (!doorOpensFor(door, state.pos)) continue;
            const res = collider.intersectCircle(
                door.collider,
                state.pos,
                env.rad + door.door.interactionRad,
            );
            if (res) state.openedDoors.add(door);
        }
    }

    private updateStairs(state: SimState, env: SimEnv) {
        for (let i = 0; i < env.structures.length; i++) {
            const stairs = env.structures[i].stairs;
            for (let j = 0; j < stairs.length; j++) {
                const stair = stairs[j];
                if (stair.lootOnly) continue;
                if (
                    !coldet.testCircleAabb(
                        state.pos,
                        env.rad,
                        stair.collision.min,
                        stair.collision.max,
                    )
                ) {
                    continue;
                }
                const down = coldet.intersectAabbCircle(
                    stair.downAabb.min,
                    stair.downAabb.max,
                    state.pos,
                    env.rad,
                );
                const up = coldet.intersectAabbCircle(
                    stair.upAabb.min,
                    stair.upAabb.max,
                    state.pos,
                    env.rad,
                );
                if (up && down) {
                    state.layer = up.pen > down.pen ? 2 : 3;
                } else if (down) {
                    state.layer = 3;
                } else if (up) {
                    state.layer = 2;
                }
                return;
            }
        }
        if (state.layer === 2) state.layer = 0;
        if (state.layer === 3) state.layer = 1;
    }

    private updateStats(dt: number) {
        this.statTicker += dt;
        if (this.statTicker < 1) return;
        this.stats.correctionsPerSec = this.statCorrections / this.statTicker;
        this.stats.snapsPerSec = this.statSnaps / this.statTicker;
        this.stats.avgCorrection = this.statCorrections
            ? this.statCorrectionSum / this.statCorrections
            : 0;
        this.stats.maxCorrection = this.statCorrectionMax;
        this.statTicker = 0;
        this.statCorrections = 0;
        this.statCorrectionSum = 0;
        this.statCorrectionMax = 0;
        this.statSnaps = 0;
    }
}
