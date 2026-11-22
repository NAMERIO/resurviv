import { math } from "../../shared/utils/math";
import { type Vec2, v2 } from "../../shared/utils/v2";

const UINT32_RANGE = 0x100000000;
const RESYNC_GAP_MS = 1000;
const DEFAULT_INTERVAL_MS = 1000 / 33;
const TICK_MARGIN_MS = 5;
const OFFSET_DRIFT = 0.005;
const JITTER_RISE = 0.5;
const JITTER_FALL = 0.02;
const INTERVAL_SMOOTH = 0.1;
const DELAY_GROW_RATE = 0.5;
const DELAY_SHRINK_RATE = 0.15;
const MIN_DELAY_MS = 15;
const MAX_DELAY_MS = 250;

export class InterpClock {
    active = false;
    snapTime = 0;
    prevSnapTime = 0;
    renderTime = 0;

    private lastRawServerTime = -1;
    private serverTime = 0;
    private offset = 0;
    private jitter = 0;
    private interval = DEFAULT_INTERVAL_MS;
    private delay = DEFAULT_INTERVAL_MS + TICK_MARGIN_MS;
    private lastTick = 0;

    reset() {
        this.active = false;
        this.snapTime = 0;
        this.prevSnapTime = 0;
        this.renderTime = 0;
        this.lastRawServerTime = -1;
        this.serverTime = 0;
        this.offset = 0;
        this.jitter = 0;
        this.interval = DEFAULT_INTERVAL_MS;
        this.delay = DEFAULT_INTERVAL_MS + TICK_MARGIN_MS;
        this.lastTick = 0;
    }

    get delayMs() {
        return this.delay;
    }

    get jitterMs() {
        return this.jitter;
    }

    onSnapshot(rawServerTime: number, now: number) {
        let serverTime: number;
        let resync = !this.active;
        if (rawServerTime < 0) {
            serverTime = now;
            resync ||= this.lastRawServerTime >= 0;
            this.lastRawServerTime = -1;
        } else if (this.lastRawServerTime < 0) {
            serverTime = rawServerTime;
            resync = true;
            this.lastRawServerTime = rawServerTime;
        } else {
            let diff =
                (rawServerTime - this.lastRawServerTime + UINT32_RANGE) % UINT32_RANGE;
            if (diff > UINT32_RANGE / 2) diff -= UINT32_RANGE;
            serverTime = this.serverTime + diff;
            this.lastRawServerTime = rawServerTime;
        }

        const gap = serverTime - this.serverTime;
        if (!resync && (gap < 0 || gap > RESYNC_GAP_MS)) resync = true;

        const sample = now - serverTime;
        if (resync) {
            this.offset = sample;
            this.jitter = 0;
        } else {
            if (gap > 0) {
                this.interval += (gap - this.interval) * INTERVAL_SMOOTH;
            }
            if (sample < this.offset) {
                this.offset = sample;
            } else {
                this.offset += (sample - this.offset) * OFFSET_DRIFT;
            }
            const dev = Math.max(0, sample - this.offset);
            this.jitter +=
                (dev - this.jitter) * (dev > this.jitter ? JITTER_RISE : JITTER_FALL);
        }

        this.serverTime = serverTime;
        const snapTime = serverTime + this.offset;
        this.prevSnapTime = this.active ? this.snapTime : snapTime;
        this.snapTime = resync ? snapTime : Math.max(snapTime, this.snapTime + 1);
        if (resync) {
            this.delay = this.targetDelay();
            this.renderTime = now - this.delay;
        }
        this.active = true;
    }

    tick(now: number) {
        if (!this.active) {
            this.lastTick = now;
            return;
        }
        const elapsed = this.lastTick ? math.clamp(now - this.lastTick, 0, 100) : 0;
        this.lastTick = now;
        const diff = this.targetDelay() - this.delay;
        const maxStep = elapsed * (diff > 0 ? DELAY_GROW_RATE : DELAY_SHRINK_RATE);
        this.delay += math.clamp(diff, -maxStep, maxStep);
        this.renderTime = Math.max(this.renderTime, now - this.delay);
    }

    private targetDelay() {
        return math.clamp(
            this.interval + this.jitter + TICK_MARGIN_MS,
            MIN_DELAY_MS,
            MAX_DELAY_MS,
        );
    }
}

export const interpClock = new InterpClock();

interface Snapshot {
    time: number;
    pos: Vec2;
    dir: Vec2;
}

const MAX_SNAPSHOTS = 32;
const TELEPORT_DIST = 8;

export class SnapshotBuffer {
    private snaps: Snapshot[] = [];

    clear() {
        this.snaps.length = 0;
    }

    push(pos: Vec2, dir: Vec2, isNew: boolean) {
        const clock = interpClock;
        if (!clock.active) {
            this.snaps.length = 0;
            return;
        }
        const time = clock.snapTime;
        const last = this.snaps[this.snaps.length - 1];
        if (isNew || !last || v2.distance(last.pos, pos) > TELEPORT_DIST) {
            this.snaps.length = 0;
            this.snaps.push({
                time: time - MAX_DELAY_MS * 2,
                pos: v2.copy(pos),
                dir: v2.copy(dir),
            });
            this.snaps.push({ time, pos: v2.copy(pos), dir: v2.copy(dir) });
            return;
        }
        if (last.time === time) {
            last.pos = v2.copy(pos);
            last.dir = v2.copy(dir);
            return;
        }
        if (last.time < clock.prevSnapTime) {
            this.snaps.push({
                time: clock.prevSnapTime,
                pos: v2.copy(last.pos),
                dir: v2.copy(last.dir),
            });
        }
        this.snaps.push({ time, pos: v2.copy(pos), dir: v2.copy(dir) });
        if (this.snaps.length > MAX_SNAPSHOTS) {
            this.snaps.splice(0, this.snaps.length - MAX_SNAPSHOTS);
        }
    }

    sample(outPos: Vec2, outDir: Vec2 | null): boolean {
        const clock = interpClock;
        const snaps = this.snaps;
        if (!clock.active || snaps.length === 0) return false;

        const time = clock.renderTime;
        let drop = 0;
        while (drop < snaps.length - 2 && snaps[drop + 1].time <= time) drop++;
        if (drop > 0) snaps.splice(0, drop);

        const a = snaps[0];
        const b = snaps.length > 1 ? snaps[1] : a;
        let t = 1;
        if (b !== a && b.time > a.time) {
            t = math.clamp((time - a.time) / (b.time - a.time), 0, 1);
        }
        outPos.x = math.lerp(t, a.pos.x, b.pos.x);
        outPos.y = math.lerp(t, a.pos.y, b.pos.y);
        if (outDir) {
            const dir = v2.normalizeSafe(v2.lerp(t, a.dir, b.dir), b.dir);
            outDir.x = dir.x;
            outDir.y = dir.y;
        }
        return true;
    }
}
