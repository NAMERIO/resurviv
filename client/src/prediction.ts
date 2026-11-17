import { MapObjectDefs } from "../../shared/defs/mapObjectDefs";
import type { ObstacleDef } from "../../shared/defs/mapObjectsTyping";
import { NpcDefs } from "../../shared/defs/npcDefs";
import { GameObjectDefs } from "../../shared/defs/gameObjectDefs";
import type { GunDef } from "../../shared/defs/gameObjects/gunDefs";
import { Action, GameConfig } from "../../shared/gameConfig";
import { getInputMoveDir, type InputMsg } from "../../shared/net/inputMsg";
import { type PredictionData, PredictionLimits } from "../../shared/net/updateMsg";
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

interface SentInput {
    seq: number;
    id: number;
    move: Vec2;
    moveTime: number;
    shootStart: boolean;
    shootHold: boolean;
}

interface Frame {
    seq: number;
    time: number;
    dt: number;
    shooting: boolean;
}

interface SimState {
    pos: Vec2;
    layer: number;
}

interface SimEnv {
    obstacles: Obstacle[];
    npcs: Npc[];
    structures: Structure[];
    rad: number;
    mapWidth: number;
    mapHeight: number;
}

export interface PredictionWorld {
    obstacles: Obstacle[];
    npcs: Npc[];
    structures: Structure[];
    mapWidth: number;
    mapHeight: number;
}

export interface PredictionGun {
    fireDelay: number;
    auto: boolean;
}

export interface PredictionTarget {
    serverPos: Vec2;
    serverLayer: number;
    rad: number;
    visualPos: Vec2;
    gun: PredictionGun | null;
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

export function getPredictionGun(
    weaponType: string | undefined,
    ammo: number,
    actionType: number,
): PredictionGun | null {
    if (!weaponType || ammo <= 0) return null;
    if (actionType === Action.Reload || actionType === Action.ReloadAlt) return null;
    const def = GameObjectDefs[weaponType] as GunDef | undefined;
    if (def?.type !== "gun" || def.fireMode === "blaster") return null;
    return { fireDelay: def.fireDelay, auto: def.fireMode === "auto" };
}

export class LocalPrediction {
    active = false;
    pos = v2.create(0, 0);
    layer = 0;
    offset = v2.create(0, 0);

    private clock = 0;
    private serverData: PredictionData | null = null;
    private serverSlowdownEnd = 0;
    private gunCooldown = 0;
    private shotTimer = 0;
    private lastFrameSeq = -1;
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

    reset() {
        this.active = false;
        this.serverData = null;
        this.serverSlowdownEnd = 0;
        this.gunCooldown = 0;
        this.shotTimer = 0;
        this.lastFrameSeq = -1;
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

        if (!this.active) {
            this.active = true;
            this.frames.length = 0;
            this.pos = v2.copy(target.serverPos);
            this.layer = target.serverLayer;
            const shown = v2.add(target.visualPos, this.releaseOffset);
            const offset = v2.sub(shown, this.pos);
            this.offset = v2.length(offset) < SNAP_DIST ? offset : v2.create(0, 0);
            this.releaseOffset = v2.create(0, 0);
        }

        const input = this.inputs[this.inputs.length - 1];
        const shooting = this.updateShooting(dt, input, target.gun);
        this.frames.push({ seq: input.seq, time: this.clock - dt, dt, shooting });

        if (this.clock - this.frames[0].time > MAX_PENDING_TIME) {
            this.frames.length = 0;
            this.pos = v2.copy(target.serverPos);
            this.layer = target.serverLayer;
        } else {
            const frame = this.frames[this.frames.length - 1];
            const env = this.buildEnv(
                world,
                this.pos,
                target.rad,
                Math.max(data.speed, data.shootSpeed) * dt,
                data.treeClimbing,
            );
            const state: SimState = { pos: this.pos, layer: this.layer };
            this.simulateSegment(
                state,
                input.move,
                frame,
                frame.time,
                frame.time + dt,
                data,
                env,
            );
            this.layer = state.layer;
        }

        this.offset = v2.mul(this.offset, Math.exp(-dt / SMOOTH_TIME));
        if (v2.lengthSqr(this.offset) < 1e-8) {
            this.offset = v2.create(0, 0);
        }

        const output = v2.add(this.pos, this.offset);
        this.lastOutput = v2.copy(output);
        return output;
    }

    private release(dt: number, target: PredictionTarget | null): Vec2 | null {
        if (this.active && target && this.lastOutput) {
            const offset = v2.sub(this.lastOutput, target.visualPos);
            this.releaseOffset = v2.length(offset) < SNAP_DIST ? offset : v2.create(0, 0);
        }
        this.active = false;
        this.lastOutput = null;
        this.lastFrameSeq = -1;
        this.shotTimer = 0;

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

    private updateShooting(dt: number, input: SentInput, gun: PredictionGun | null) {
        const firstFrame = input.seq !== this.lastFrameSeq;
        this.lastFrameSeq = input.seq;
        this.gunCooldown = Math.max(0, this.gunCooldown - dt);

        if (gun) {
            const trigger =
                (input.shootStart && firstFrame) || (input.shootHold && gun.auto);
            if (trigger && this.gunCooldown <= 0) {
                this.gunCooldown = gun.fireDelay;
                this.shotTimer = gun.fireDelay;
            }
        }

        const shooting = this.shotTimer > 0;
        this.shotTimer = Math.max(0, this.shotTimer - dt);
        return shooting;
    }

    private simulateSegment(
        state: SimState,
        move: Vec2,
        frame: Frame,
        start: number,
        end: number,
        data: PredictionData,
        env: SimEnv,
    ) {
        if (frame.shooting) {
            this.simulate(state, move, end - start, data.shootSpeed, env);
            return;
        }
        const slowEnd = math.clamp(this.serverSlowdownEnd, start, end);
        if (slowEnd > start) {
            this.simulate(state, move, slowEnd - start, data.shootSpeed, env);
        }
        if (end > slowEnd) {
            this.simulate(state, move, end - slowEnd, data.speed, env);
        }
    }

    onServerUpdate(
        data: PredictionData | null | undefined,
        target: PredictionTarget | null,
        world: PredictionWorld,
    ) {
        this.serverData = data ?? null;
        if (!this.active || !data || !target) return;

        const state: SimState = {
            pos: v2.copy(target.serverPos),
            layer: target.serverLayer,
        };

        const ackIdx = this.findInputIdx(data.inputId);
        if (ackIdx < 0) {
            this.frames.length = 0;
            this.stats.pendingMs = 0;
        } else {
            const ack = this.inputs[ackIdx];
            const cut =
                ack.moveTime + Math.max(data.moveAge, PredictionLimits.minMoveAge);
            this.serverSlowdownEnd = cut + data.slowdownLeft;

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
                    Math.max(data.speed, data.shootSpeed) * replayTime,
                    data.treeClimbing,
                );
                const firstSeq = this.inputs[0].seq;
                for (let i = 0; i < this.frames.length; i++) {
                    const frame = this.frames[i];
                    const start = Math.max(frame.time, cut);
                    const end = frame.time + frame.dt;
                    if (end <= start) continue;
                    const input = this.inputs[frame.seq - firstSeq];
                    if (!input) continue;
                    this.simulateSegment(state, input.move, frame, start, end, data, env);
                }
            }
            this.stats.pendingMs = replayTime * 1000;
        }

        const delta = v2.sub(this.pos, state.pos);
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

        this.pos = state.pos;
        this.layer = state.layer;
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
        treeClimbing: boolean,
    ): SimEnv {
        const range = rad + travel + BROADPHASE_MARGIN;

        const obstacles: Obstacle[] = [];
        for (let i = 0; i < world.obstacles.length; i++) {
            const obstacle = world.obstacles[i];
            if (!obstacle.active || obstacle.dead || !obstacle.collidable) continue;
            if (!obstacle.collider) continue;
            if (treeClimbing && (MapObjectDefs[obstacle.type] as ObstacleDef).isTree) {
                continue;
            }
            const aabb = this.getAabb(obstacle.collider);
            if (!coldet.testCircleAabb(center, range, aabb.min, aabb.max)) continue;
            obstacles.push(obstacle);
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
            npcs,
            structures,
            rad,
            mapWidth: world.mapWidth,
            mapHeight: world.mapHeight,
        };
    }

    private simulate(
        state: SimState,
        move: Vec2,
        dt: number,
        speed: number,
        env: SimEnv,
    ) {
        const substeps = Math.max(1, Math.ceil(dt / SERVER_TICK - 0.0001));
        const subDt = dt / substeps;
        for (let i = 0; i < substeps; i++) {
            this.step(state, move, subDt, speed, env);
        }
    }

    private step(state: SimState, move: Vec2, dt: number, speed: number, env: SimEnv) {
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
