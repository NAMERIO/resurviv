import * as PIXI from "pixi.js-legacy";
import { math } from "../../../shared/utils/math";
import { type DeepPartial, util } from "../../../shared/utils/util";
import { type Vec2, v2 } from "../../../shared/utils/v2";
import type { Camera } from "../camera";
import type { Map } from "../map";
import type { Renderer } from "../renderer";
import { SDK } from "../sdk/sdk";

class Range {
    constructor(
        public min: number,
        public max: number,
    ) {}

    getRandom() {
        return util.random(this.min, this.max);
    }
}

function getRangeValue(val: number | Range) {
    if (val instanceof Range) {
        return val.getRandom();
    }
    return val;
}

function getColorValue(val: (() => number) | number) {
    return val instanceof Function ? val() : val;
}

export class Particle {
    active = false;
    ticker = 0;
    def = {} as ParticleDef;
    sprite = new PIXI.Sprite();
    hasParent = false;

    pos!: Vec2;
    vel!: Vec2;
    rot!: number;
    delay!: number;
    life!: number;
    drag!: number;
    rotVel!: number;
    rotDrag!: number;
    scaleUseExp!: boolean;
    scale!: number;
    scaleEnd!: number;
    scaleExp!: number;

    alphaUseExp!: boolean;
    alpha!: number;
    alphaEnd!: number;
    alphaExp!: number;

    alphaIn!: boolean;
    alphaInStart!: number;
    alphaInEnd!: number;

    emitterIdx!: number;
    valueAdjust!: number;

    constructor() {
        this.sprite.anchor.set(0.5, 0.5);
        this.sprite.scale.set(1, 1);
        this.sprite.visible = false;
    }

    init(
        renderer: Renderer,
        type: string,
        layer: number,
        pos: Vec2,
        vel: Vec2,
        scale: number,
        rot: number,
        parent: PIXI.Container | null,
        zOrd: number,
        valueAdjust: number,
    ) {
        const def = ParticleDefs[type];
        this.active = true;
        this.ticker = 0;
        if (parent) {
            this.hasParent = true;
            parent.addChild(this.sprite);
        } else {
            this.hasParent = false;
            renderer.addPIXIObj(this.sprite, layer, zOrd);
        }
        this.pos = v2.copy(pos);
        this.vel = v2.copy(vel);
        this.rot = rot;
        this.def = def;
        this.delay = 0;
        this.life = getRangeValue(def.life);
        this.drag = getRangeValue(def.drag);
        this.rotVel = getRangeValue(def.rotVel) * (Math.random() < 0.5 ? -1 : 1);
        this.rotDrag = getRangeValue(def.drag) / 2;
        this.scaleUseExp = def.scale.exp !== undefined;
        this.scale = getRangeValue(def.scale.start) * scale;
        this.scaleEnd = this.scaleUseExp ? 0 : getRangeValue(def.scale?.end!) * scale;
        this.scaleExp = this.scaleUseExp ? def.scale.exp! : 0;
        this.alphaUseExp = def.alpha.exp !== undefined;
        this.alpha = getRangeValue(def.alpha.start);
        this.alphaEnd = this.alphaUseExp ? 0 : getRangeValue(def.alpha?.end!);
        this.alphaExp = this.alphaUseExp ? def.alpha.exp! : 0;
        this.alphaIn = def.alphaIn !== undefined;
        this.alphaInStart = this.alphaIn ? getRangeValue(def.alphaIn?.start!) : 0;
        this.alphaInEnd = this.alphaIn ? getRangeValue(def.alphaIn?.end!) : 0;
        this.emitterIdx = -1;
        const tex = Array.isArray(def.image)
            ? def.image[Math.floor(Math.random() * def.image.length)]
            : def.image;
        this.sprite.texture = PIXI.Texture.from(tex);
        this.sprite.visible = false;
        this.valueAdjust = def.ignoreValueAdjust ? 1 : valueAdjust;
        this.setColor(getColorValue(def.color!));

        if (SDK.disableBloodParticles() && type == "bloodSplat") {
            this.sprite.renderable = false;
        } else {
            this.sprite.renderable = true;
        }
    }

    free() {
        this.active = false;
        this.sprite.visible = false;
    }

    setDelay(delay: number) {
        this.delay = delay;
    }

    setColor(color: number) {
        if (this.valueAdjust < 1) {
            color = util.adjustValue(color, this.valueAdjust);
        }
        this.sprite.tint = color;
    }
}

interface EmitterOptions {
    pos?: Vec2;
    dir?: Vec2;
    scale?: number;
    layer?: number;
    duration?: number;
    radius?: number;
    rateMult?: number;
    parent?: PIXI.Container | null;
}

export class Emitter {
    active = false;
    enabled!: boolean;
    type!: string;
    pos!: Vec2;
    dir!: Vec2;
    scale!: number;
    layer!: number;
    duration!: number;
    radius!: number;
    ticker!: number;
    nextSpawn!: number;
    spawnCount!: number;
    parent!: PIXI.Container | null;
    alpha!: number;
    rateMult!: number;
    zOrd!: number;

    init(type: string, options = {} as EmitterOptions) {
        const def = EmitterDefs[type];
        this.active = true;
        this.enabled = true;
        this.type = type;
        this.pos = options.pos ? v2.copy(options.pos) : v2.create(0, 0);
        this.dir = options.dir ? v2.copy(options.dir) : v2.create(0, 1);
        this.scale = options.scale !== undefined ? options.scale : 1;
        this.layer = options.layer || 0;
        this.duration =
            options.duration !== undefined ? options.duration : Number.MAX_VALUE;
        this.radius = options.radius !== undefined ? options.radius : def.radius;
        this.ticker = 0;
        this.nextSpawn = 0;
        this.spawnCount = 0;
        this.parent = options.parent || null;
        this.alpha = 1;
        this.rateMult = options.rateMult !== undefined ? options.rateMult : 1;
        const partDef = ParticleDefs[def.particle];
        this.zOrd =
            def.zOrd !== undefined
                ? def.zOrd
                : partDef.zOrd !== undefined
                  ? partDef.zOrd
                  : 20;
    }

    free() {
        this.active = false;
    }

    stop() {
        this.duration = this.ticker;
    }
}

export class ParticleBarn {
    particles: Particle[] = [];
    emitters: Emitter[] = [];
    noopParticle = new Particle();
    valueAdjust = 1;

    constructor(public renderer: Renderer) {
        for (let i = 0; i < 256; i++) {
            this.particles[i] = new Particle();
        }
    }

    onMapLoad(map: Map) {
        this.valueAdjust = map.getMapDef().biome.valueAdjust;
    }

    m_free() {
        for (let i = 0; i < this.particles.length; i++) {
            const sprite = this.particles[i].sprite;
            sprite.parent?.removeChild(sprite);
            sprite.destroy({
                children: true,
            });
        }
    }

    addParticle(
        type: string,
        layer: number,
        pos: Vec2,
        vel: Vec2,
        scale?: number,
        rot?: number,
        parent?: PIXI.Container | null,
        zOrd?: number,
    ) {
        const def = ParticleDefs[type];
        if (!def) {
            return this.noopParticle;
        }

        let particle = null;
        for (let i = 0; i < this.particles.length; i++) {
            if (!this.particles[i].active) {
                particle = this.particles[i];
                break;
            }
        }
        if (!particle) {
            particle = new Particle();
            this.particles.push(particle);
        }
        scale = scale !== undefined ? scale : 1;
        rot = rot !== undefined ? rot : Math.random() * Math.PI * 2;
        zOrd = zOrd !== undefined ? zOrd : def.zOrd || 20;

        particle.init(
            this.renderer,
            type,
            layer,
            pos,
            vel,
            scale,
            rot,
            parent!,
            zOrd,
            this.valueAdjust,
        );
        return particle;
    }

    addRippleParticle(pos: Vec2, layer: number, color: number) {
        const particle = this.addParticle(
            "waterRipple",
            layer,
            pos,
            v2.create(0, 0),
            1,
            0,
            null,
        );
        particle.setColor(color);
        return particle;
    }

    addEmitter(type: string, options = {} as Partial<EmitterOptions>) {
        let emitter = null;

        for (let i = 0; i < this.emitters.length; i++) {
            if (!this.emitters[i].active) {
                emitter = this.emitters[i];
                break;
            }
        }

        if (!emitter) {
            emitter = new Emitter();
            this.emitters.push(emitter);
        }

        emitter.init(type, options);
        return emitter;
    }

    m_update(dt: number, camera: Camera) {
        // Update emitters
        for (let i = 0; i < this.emitters.length; i++) {
            const e = this.emitters[i];
            if (e.active && e.enabled) {
                e.ticker += dt;
                e.nextSpawn -= dt;
                const def = EmitterDefs[e.type];
                while (e.nextSpawn <= 0 && e.spawnCount < def.maxCount) {
                    const rad = e.scale * e.radius;
                    const pos = v2.add(e.pos, util.randomPointInCircle(rad));
                    const dir = v2.rotate(e.dir, (Math.random() - 0.5) * def.angle);
                    const vel = v2.mul(dir, getRangeValue(def.speed));
                    const rot = getRangeValue(def.rot!);
                    const particle = this.addParticle(
                        def.particle,
                        e.layer,
                        pos,
                        vel,
                        e.scale,
                        rot,
                        e.parent,
                        e.zOrd,
                    );
                    particle.emitterIdx = i;
                    let rate = getRangeValue(def.rate);
                    if (def.maxRate) {
                        const w = math.easeInExpo(
                            math.min(1, e.ticker / def.maxElapsed!),
                        );
                        const maxRate = getRangeValue(def.maxRate);
                        rate = math.lerp(w, rate, maxRate);
                    }
                    e.nextSpawn += rate * e.rateMult;
                    e.spawnCount++;
                }
                if (e.ticker >= e.duration) {
                    e.free();
                }
            }
        }

        // Update particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (p.active && ((p.ticker += dt), p.ticker >= p.delay)) {
                const t = math.min((p.ticker - p.delay) / p.life, 1);
                const drag = 1 / (1 + dt * p.drag);
                p.vel.x *= drag;
                p.vel.y *= drag;
                p.pos.x += p.vel.x * dt;
                p.pos.y += p.vel.y * dt;
                p.rotVel *= 1 / (1 + dt * p.rotDrag);
                p.rot += p.rotVel * dt;
                if (p.scaleUseExp) {
                    p.scale += dt * p.scaleExp;
                }
                if (p.alphaUseExp) {
                    p.alpha = math.max(p.alpha + dt * p.alphaExp, 0);
                }
                const pos = p.hasParent ? p.pos : camera.m_pointToScreen(p.pos);
                let scale = p.scaleUseExp
                    ? p.scale
                    : math.remap(
                          t,
                          (p.def.scale.lerp as Range)?.min,
                          (p.def.scale.lerp as Range)?.max,
                          p.scale,
                          p.scaleEnd,
                      );
                let alpha = p.alphaUseExp
                    ? p.alpha
                    : math.remap(
                          t,
                          p.def.alpha.lerp?.min!,
                          p.def.alpha.lerp?.max!,
                          p.alpha,
                          p.alphaEnd,
                      );
                if (p.alphaIn && t < p.def.alphaIn?.lerp?.max!) {
                    alpha = math.remap(
                        t,
                        p.def.alphaIn?.lerp?.min!,
                        p.def.alphaIn?.lerp?.max!,
                        p.alphaInStart,
                        p.alphaInEnd,
                    );
                }

                // @HACK
                if (p.emitterIdx >= 0) {
                    alpha *= this.emitters[p.emitterIdx].alpha;
                }
                if (!p.hasParent) {
                    scale = camera.m_pixels(scale);
                }
                p.sprite.position.set(pos.x, pos.y);
                p.sprite.scale.set(scale, scale);
                p.sprite.rotation = p.rot;
                p.sprite.alpha = alpha;
                p.sprite.visible = true;

                // Die if it's time
                if (t >= 1) {
                    p.free();
                }
            }
        }
    }
}

function createChip(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: ["part-spark-01.img"],
        life: 0.5,
        drag: new Range(1, 5),
        rotVel: new Range(0, 0),
        scale: {
            start: new Range(0.04, 0.08),
            end: new Range(0.01, 0.02),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.95, 1),
        },
        color: 0xffffff,
    };
    return util.mergeDeep(baseDef, overrides);
}

function createGlassChip(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef = createChip({
        rotVel: new Range(Math.PI * 1, Math.PI * 6),
        scale: {
            start: new Range(0.02, 0.04),
            end: new Range(0.01, 0.02),
            lerp: new Range(0, 1),
        },
        color: 0x80d9ff,
    });
    return util.mergeDeep(baseDef, overrides);
}

function createWoodChip(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef = createChip({
        image: ["part-woodchip-01.img"],
        life: new Range(0.5, 1),
        rotVel: new Range(Math.PI * 3, Math.PI * 3),
        alpha: {
            lerp: new Range(0.9, 1),
        },
    });
    return util.mergeDeep(baseDef, overrides);
}

function createPlank(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: ["part-plank-01.img"],
        life: new Range(1, 1.5),
        drag: new Range(1, 5),
        rotVel: new Range(Math.PI * 3, Math.PI * 3),
        scale: {
            start: new Range(0.1, 0.2),
            end: new Range(0.08, 0.18),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.9, 1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.05, 1, util.random(0.25, 0.35)));
        },
    };
    return util.mergeDeep(baseDef, overrides);
}

function createLeaf(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: ["part-leaf-01.img"],
        life: new Range(0.5, 1),
        drag: new Range(1, 5),
        rotVel: new Range(Math.PI * 3, Math.PI * 3),
        scale: {
            start: new Range(0.04, 0.08),
            end: new Range(0.01, 0.02),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.9, 1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.5, 0.75)));
        },
    };
    return util.mergeDeep(baseDef, overrides);
}

function createSmallBreak(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: ["part-spark-01.img"],
        life: new Range(0.8, 1),
        drag: new Range(1, 5),
        rotVel: 0,
        scale: {
            start: new Range(0.07, 0.12),
            end: new Range(0.05, 0.1),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.9, 1),
        },
        color: 0xffffff,
    };
    return util.mergeDeep(baseDef, overrides);
}

function createLargeBreak(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: ["part-plank-01.img"],
        life: new Range(0.5, 1.5),
        drag: new Range(1, 5),
        rotVel: new Range(0, Math.PI * 3),
        scale: {
            start: new Range(0.25, 0.55),
            end: new Range(0.08, 0.18),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.9, 1),
        },
        color: 0xffffff,
    };
    return util.mergeDeep(baseDef, overrides);
}

function createGlassBreak(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: ["part-spark-01.img"],
        life: new Range(0.4, 0.8),
        drag: new Range(1, 4),
        rotVel: new Range(Math.PI * 1, Math.PI * 6),
        scale: {
            start: new Range(0.03, 0.06),
            end: new Range(0.05, 0.1),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 0.8,
            end: 0,
            lerp: new Range(0.75, 1),
        },
        color: 0x80d9ff,
    };
    return util.mergeDeep(baseDef, overrides);
}

function createDepositBoxBreak(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: ["part-plate-01.img"],
        life: new Range(0.5, 1),
        drag: new Range(6, 8),
        rotVel: new Range(0, Math.PI * 3),
        scale: {
            start: new Range(0.2, 0.35),
            end: new Range(0.18, 0.25),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.9, 1),
        },
        color: 0xffffff,
    };
    return util.mergeDeep(baseDef, overrides);
}

function createCasing(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: ["part-shell-01.img"],
        life: new Range(0.5, 0.75),
        drag: new Range(3, 4),
        rotVel: new Range(Math.PI * 3, Math.PI * 3),
        scale: {
            start: 0.0625,
            end: 0.0325,
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.95, 1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.9, 0.95)));
        },
    };
    return util.mergeDeep(baseDef, overrides);
}

function createExplosion(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: ["part-frag-burst-01.img"],
        life: 0.5,
        drag: 0,
        rotVel: 0,
        scale: {
            start: 1,
            end: 4,
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.75, 1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.065, 1, util.random(0.98, 0.99)));
        },
    };
    return util.mergeDeep(baseDef, overrides);
}

function createSmoke(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: ["part-smoke-01.img"],
        life: new Range(2, 3),
        drag: 0,
        rotVel: new Range(Math.PI * 0.25, Math.PI * 0.5),
        scale: {
            start: new Range(0.07, 0.12),
            end: new Range(0.05, 0.1),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.9, 1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.9, 0.95)));
        },
    };
    return util.mergeDeep(baseDef, overrides);
}

function createAirdropPart(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: ["part-airdrop-01.img"],
        life: new Range(0.85, 1.15),
        drag: new Range(2, 2.25),
        rotVel: new Range(Math.PI * 1, Math.PI * 2),
        scale: {
            start: 0.5,
            end: 0.4,
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.9, 1),
        },
        color: 0xffffff,
    };
    return util.mergeDeep(baseDef, overrides);
}

function createAmbientLeaves(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: [
            "part-leaf-03.img",
            "part-leaf-04.img",
            "part-leaf-05.img",
            "part-leaf-06.img",
        ],
        life: new Range(10, 15),
        drag: new Range(0, 0),
        rotVel: new Range(Math.PI * 0.25, Math.PI * 0.5),
        scale: {
            start: new Range(0.12, 0.15),
            end: new Range(0.08, 0.11),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.9, 1),
        },
        alphaIn: {
            start: 0,
            end: 1,
            lerp: new Range(0, 0.05),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.9, 0.95)));
        },
    };
    return util.mergeDeep(baseDef, overrides);
}

function createThrowableImpact(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: ["part-snow-01.img"],
        life: new Range(0.5, 1),
        drag: new Range(0, 0),
        rotVel: new Range(Math.PI * 0.25, Math.PI * 0.5),
        scale: {
            start: new Range(0.13, 0.23),
            end: new Range(0.07, 0.14),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.9, 1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.9, 0.95)));
        },
    };
    return util.mergeDeep(baseDef, overrides);
}

function createHeal(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: ["part-heal-basic.img"],
        life: new Range(0.75, 1),
        drag: 0.25,
        rotVel: new Range(0, 0),
        scale: {
            start: new Range(0.1, 0.12),
            end: new Range(0.05, 0.07),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.7, 1),
        },
        alphaIn: {
            start: 0,
            end: 1,
            lerp: new Range(0, 0.05),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 1, util.random(0.7, 1)));
        },
        ignoreValueAdjust: true,
    };
    return util.mergeDeep(baseDef, overrides);
}

function createBoost(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: ["part-boost-basic.img"],
        life: new Range(0.75, 1),
        drag: 0,
        rotVel: new Range(Math.PI * 0.25, Math.PI * 0.5),
        scale: {
            start: new Range(0.12, 0.14),
            end: new Range(0.06, 0.08),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.7, 1),
        },
        alphaIn: {
            start: 0,
            end: 1,
            lerp: new Range(0, 0.05),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.3, 1, util.random(0.7, 1)));
        },
        ignoreValueAdjust: true,
    };
    return util.mergeDeep(baseDef, overrides);
}

function createStim(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: [
            "part-blossom-01.img",
            "part-blossom-02.img",
            "part-blossom-03.img",
            "part-blossom-04.img",
        ],
        life: new Range(4, 5),
        drag: 0,
        rotVel: new Range(Math.PI * 0.25, Math.PI * 0.5),
        scale: {
            start: new Range(0.12, 0.14),
            end: new Range(0.06, 0.08),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.7, 1),
        },
        alphaIn: {
            start: 0,
            end: 1,
            lerp: new Range(0, 0.05),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.37, 1, util.random(0.95, 1)));
        },
    };
    return util.mergeDeep(baseDef, overrides);
}

function createSkinTrail(overrides: DeepPartial<ParticleDef>): ParticleDef {
    const baseDef: ParticleDef = {
        image: ["part-stars-scrolls-01.img", "part-stars-scrolls-02.img"],
        life: new Range(1.6, 2.3),
        drag: new Range(0.04, 0.1),
        rotVel: new Range(Math.PI * 0.03, Math.PI * 0.12),
        scale: {
            start: new Range(0.11, 0.15),
            end: new Range(0.06, 0.1),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 0.95,
            end: 0,
            lerp: new Range(0.55, 1),
        },
        alphaIn: {
            start: 0,
            end: 1,
            lerp: new Range(0, 0.12),
        },
        color: 0xffffff,
        ignoreValueAdjust: true,
    };
    return util.mergeDeep(baseDef, overrides);
}

const ParticleDefs: Record<string, ParticleDef> = {
    archwayBreak: createLargeBreak({
        scale: {
            start: new Range(0.2, 0.35),
            end: new Range(0.08, 0.12),
            lerp: new Range(0, 1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.06, 0.84, util.random(0.46, 0.48)));
        },
    }),
    bloodSplat: {
        image: ["part-splat-01.img", "part-splat-02.img", "part-splat-03.img"],
        life: 0.5,
        drag: 1,
        rotVel: 0,
        scale: {
            start: 0.04,
            end: new Range(0.15, 0.2),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.75, 1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0xff0000, 1, util.random(0.45, 0.8)));
        },
    },
    bite: {
        image: [
            "part-blood-bite-01.img",
            "part-blood-bite-02.img",
            "part-blood-bite-03.img",
            "part-blood-bite-04.img",
            "part-blood-bite-05.img",
            "part-blood-bite-06.img",
        ],
        life: 1,
        drag: 1,
        rotVel: 0,
        scale: {
            start: new Range(0.4, 0.5),
            end: new Range(0.07, 0.1),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.75, 1),
        },
        color: 0xffffff,
    },
    skitterBlood: {
        image: [
            "part-blood-skitter-01.img",
            "part-blood-skitter-02.img",
            "part-blood-skitter-03.img",
            "part-blood-skitter-04.img",
            "part-blood-skitter-05.img",
            "part-blood-skitter-06.img",
        ],
        life: new Range(0.5, 1),
        drag: 1,
        rotVel: new Range(0, Math.PI * 3),
        scale: {
            start: new Range(0.4, 0.5),
            end: new Range(0.07, 0.1),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.9, 1),
        },
        color: 0xffffff,
    },
    barrelPlank: createPlank({
        scale: {
            start: new Range(0.08, 0.18),
            end: new Range(0.07, 0.17),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.09, 0.8, util.random(0.66, 0.68)));
        },
    }),
    barrelChip: createChip({
        drag: new Range(1, 10),
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.01, 0.02, util.random(0.38, 0.41)));
        },
    }),
    fenceChip: {
        image: ["part-fence-01.img"],
        life: new Range(0.45, 0.7),
        drag: new Range(2, 6),
        rotVel: new Range(Math.PI * 2, Math.PI * 5),
        scale: {
            start: new Range(0.08, 0.14),
            end: new Range(0.03, 0.07),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.75, 1),
        },
        color: 0xffffff,
    },
    barrelBreak: createSmallBreak({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.01, 0.02, util.random(0.38, 0.41)));
        },
    }),
    blackChip: createWoodChip({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0.08, util.random(0.16, 0.18)));
        },
    }),
    blueChip: createChip({
        drag: new Range(1, 10),
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.64, 1, util.random(0.83, 0.85)));
        },
    }),
    book: {
        image: ["part-book-01.img"],
        life: new Range(1, 1.5),
        drag: new Range(3, 5),
        rotVel: new Range(Math.PI * 3, Math.PI * 3),
        scale: {
            start: new Range(0.09, 0.19),
            end: new Range(0.07, 0.17),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.9, 1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.08, 0.42, util.random(0.72, 0.74)));
        },
    },
    bottleBrownChip: createGlassChip({
        color: 0x783808,
    }),
    bottleBrownBreak: createGlassBreak({
        color: 0x783808,
    }),
    bottleBlueChip: createGlassChip({
        color: 0x4c58,
    }),
    bottleWhiteBreak: createGlassBreak({
        alpha: {
            start: 0.75,
        },
        color: 0xffffff,
    }),
    bottleWhiteChip: createGlassChip({
        alpha: {
            start: 0.75,
            end: 0,
            lerp: new Range(0.95, 1),
        },
        color: 0xffffff,
    }),
    bottleBlueBreak: createGlassBreak({
        color: 0x4c58,
    }),
    brickChip: createChip({
        drag: new Range(1, 10),
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0.71, util.random(0.32, 0.34)));
        },
    }),
    clothBreak: createSmallBreak({
        image: ["part-cloth-01.img"],
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.95, 1)));
        },
    }),
    clothHit: createChip({
        image: ["part-cloth-01.img"],
        drag: new Range(1, 10),
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.95, 1)));
        },
    }),
    eggParticle: {
        image: [
            "part-egg-01.img",
            "part-egg-02.img",
            "part-egg-03.img",
            "part-egg-04.img",
        ],
        life: 0.5,
        drag: new Range(1, 10),
        rotVel: 0,
        scale: {
            start: new Range(0.3, 0.4),
            end: new Range(0.01, 0.02),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.95, 1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.97, 0, util.random(0.95, 0.97)));
        },
    },
    depositBoxGreyBreak: createDepositBoxBreak({
        drag: new Range(7, 8),
        scale: {
            start: new Range(0.15, 0.25),
            end: new Range(0.12, 0.2),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.36, 0.38)));
        },
    }),
    depositBoxGoldBreak: createDepositBoxBreak({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.11, 0.84, util.random(0.64, 0.66)));
        },
    }),
    glassChip: createGlassChip({
        scale: {
            start: new Range(0.04, 0.08),
        },
    }),
    glassPlank: createPlank({
        color: 0x80d9ff,
    }),
    goldChip: createChip({
        drag: new Range(1, 10),
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.11, 0.84, util.random(0.88, 0.9)));
        },
    }),
    pinkChip: createWoodChip({
        image: ["part-spark-01.img"],
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0.52, util.random(0.98, 1)));
        },
    }),
    ltblueChip: createWoodChip({
        image: ["part-spark-01.img"],
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.5, 0.65, util.random(0.98, 1)));
        },
    }),
    yellowChip: createWoodChip({
        image: ["part-spark-01.img"],
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.16, 0.73, util.random(0.98, 1)));
        },
    }),
    greenChip: createChip({
        drag: new Range(1, 10),
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.4, 0.18, util.random(0.5, 0.62)));
        },
    }),
    greenPlank: createPlank({
        scale: {
            start: new Range(0.08, 0.16),
            end: new Range(0.05, 0.1),
        },
        color: 0x3b452f,
    }),
    greenhouseBreak: createLargeBreak({
        image: ["part-spark-01.img", "part-plate-01.img", "part-plank-01.img"],
        rotVel: new Range(Math.PI * 1, Math.PI * 6),
        alpha: {
            start: 0.8,
            lerp: new Range(0.75, 1),
        },
        color: 0x80d9ff,
    }),
    hutBreak: createLargeBreak({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.1, 0.81, util.random(0.78, 0.82)));
        },
    }),
    leaf: createLeaf({}),
    leafPrickly: createLeaf({
        image: ["part-leaf-01sv.img"],
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.8, 0.85)));
        },
    }),
    leafRiver: createLeaf({
        image: ["part-leaf-02.img"],
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.5, 0.75)));
        },
    }),
    tumbleweed: createLeaf({
        image: ["part-tumbleweed-01.img"],
        scale: {
            start: new Range(0.08, 0.12),
            end: new Range(0.02, 0.03),
        },
        color: function () {
            return util.rgbToInt(
                util.hsvToRgb(
                    util.random(0.05, 0.08),
                    util.random(0.2, 0.3),
                    util.random(0.25, 0.75),
                ),
            );
        },
    }),
    lockerBreak: createDepositBoxBreak({
        drag: new Range(7, 8),
        scale: {
            start: new Range(0.15, 0.2),
            end: new Range(0.12, 0.15),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.1, 0.23, util.random(0.51, 0.53)));
        },
    }),
    ltgreenChip: createWoodChip({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.2, 0.42, util.random(0.38, 0.42)));
        },
    }),
    outhouseChip: createWoodChip({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.08, 0.57, util.random(0.4, 0.46)));
        },
    }),
    outhouseBreak: createLargeBreak({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.08, 0.79, util.random(0.52, 0.54)));
        },
    }),
    outhousePlank: createPlank({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.08, 0.57, util.random(0.4, 0.46)));
        },
    }),
    potChip: createChip({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.06, 0.84, util.random(0.73, 0.77)));
        },
    }),
    potBreak: createSmallBreak({
        image: ["part-pot-01.img"],
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.06, 0.84, util.random(0.73, 0.77)));
        },
    }),
    potatoChip: createChip({
        drag: new Range(1, 10),
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.075, 0.43, util.random(0.48, 0.5)));
        },
    }),
    potatoBreak: createSmallBreak({
        image: ["part-pumpkin-01.img"],
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.075, 0.43, util.random(0.48, 0.5)));
        },
    }),
    pumpkinChip: createChip({
        life: 0.5,
        drag: new Range(1, 10),
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.07, 1, util.random(0.98, 1)));
        },
    }),
    pumpkinBreak: createSmallBreak({
        image: ["part-pumpkin-01.img"],
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.08, 1, util.random(0.95, 0.97)));
        },
    }),
    squashChip: createChip({
        drag: new Range(1, 10),
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.31, 0.86, util.random(0.35, 0.36)));
        },
    }),
    squashBreak: createSmallBreak({
        image: ["part-pumpkin-01.img"],
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.31, 0.86, util.random(0.35, 0.36)));
        },
    }),
    redChip: createChip({
        drag: new Range(1, 10),
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.98, 1, util.random(0.52, 0.54)));
        },
    }),
    redBreak: createSmallBreak({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.98, 1, util.random(0.52, 0.54)));
        },
    }),
    redPlank: createPlank({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.02, 1, util.random(0.26, 0.28)));
        },
    }),
    strongRedPlank: createPlank({
        color: 0xcb0101,
    }),
    rockChip: createChip({
        image: ["map-stone-01.img"],
        drag: new Range(1, 10),
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.5, 0.75)));
        },
    }),
    rockBreak: createSmallBreak({
        image: ["map-stone-01.img"],
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.5, 0.75)));
        },
    }),
    rockBlackChip: createChip({
        image: ["map-stone-01.img"],
        drag: new Range(1, 10),
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.1, 0.3)));
        },
    }),
    rockBlackBreak: createSmallBreak({
        image: ["map-stone-01.img"],
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.1, 0.3)));
        },
    }),
    rockEyeChip: createChip({
        image: ["map-stone-01.img"],
        drag: new Range(1, 10),
        scale: {
            start: new Range(0.03, 0.06),
        },
        color: 0x292421,
    }),
    rockEyeBreak: createSmallBreak({
        image: ["map-stone-01.img"],
        drag: new Range(4, 12),
        scale: {
            start: new Range(0.05, 0.1),
            end: new Range(0.03, 0.06),
        },
        color: 0x292421,
    }),
    shackBreak: createLargeBreak({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.1, 0.24, util.random(0.38, 0.41)));
        },
    }),
    shackGreenBreak: createLargeBreak({
        color: 0x577066,
    }),
    tanChip: createWoodChip({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.1, 0.35, util.random(0.48, 0.52)));
        },
    }),
    teahouseBreak: createLargeBreak({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.6, 0.31, util.random(0.42, 0.45)));
        },
    }),
    teapavilionBreak: createLargeBreak({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0.8, util.random(0.6, 0.62)));
        },
    }),
    toiletBreak: createSmallBreak({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.97, 0, util.random(0.95, 0.97)));
        },
    }),
    toiletMetalBreak: createSmallBreak({
        drag: new Range(4, 5),
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.01, 0.02, util.random(0.38, 0.41)));
        },
    }),
    turkeyFeathersHit: {
        image: ["part-feather-01.img", "part-feather-02.img"],
        life: new Range(1, 1.5),
        drag: new Range(1, 10),
        rotVel: new Range(0, Math.PI * 3),
        scale: {
            start: new Range(0.1, 0.2),
            end: new Range(0.08, 0.12),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.95, 1),
        },
        color: function () {
            return 0xffffff;
        },
    },
    turkeyFeathersDeath: {
        image: ["part-feather-01.img", "part-feather-02.img"],
        life: new Range(1, 1.5),
        drag: new Range(1, 10),
        rotVel: new Range(0, Math.PI * 3),
        scale: {
            start: new Range(0.15, 0.25),
            end: new Range(0.12, 0.2),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.95, 1),
        },
        color: function () {
            return 0xffffff;
        },
    },
    deathSplash: {
        image: ["part-splat-01.img", "part-splat-02.img", "part-splat-03.img"],
        life: new Range(0.8, 1.2),
        drag: new Range(2, 5),
        rotVel: new Range(0, Math.PI * 2),
        scale: {
            start: new Range(0.08, 0.15),
            end: new Range(0.2, 0.35),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.7, 1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 1, util.random(0.5, 0.8)));
        },
    },
    bloodExplosion: {
        image: ["part-splat-01.img", "part-splat-02.img", "part-splat-03.img"],
        life: new Range(1.0, 1.5),
        drag: new Range(1, 3),
        rotVel: new Range(Math.PI, Math.PI * 3),
        scale: {
            start: new Range(0.12, 0.2),
            end: new Range(0.3, 0.5),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.6, 1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 1, util.random(0.4, 0.7)));
        },
    },
    confettiDeath: {
        image: [
            "part-death-confetti-01.img",
            "part-death-confetti-02.img",
            "part-death-confetti-03.img",
            "part-death-confetti-04.img",
            "part-death-confetti-05.img",
            "part-death-confetti-06.img",
            "part-death-confetti-07.img",
            "part-death-confetti-08.img",
            "part-death-confetti-09.img",
            "part-death-confetti-10.img",
            "part-death-confetti-11.img",
            "part-death-confetti-12.img",
            "part-death-confetti-13.img",
            "part-death-confetti-14.img",
            "part-death-confetti-15.img",
            "part-death-confetti-16.img",
            "part-death-confetti-17.img",
            "part-death-confetti-18.img",
            "part-death-confetti-19.img",
            "part-death-confetti-20.img",
            "part-death-confetti-21.img",
            "part-death-confetti-22.img",
            "part-death-confetti-23.img",
            "part-death-confetti-24.img",
            "part-death-confetti-25.img",
            "part-death-confetti-26.img",
            "part-death-confetti-27.img",
            "part-death-confetti-28.img",
            "part-death-confetti-29.img",
            "part-death-confetti-30.img",
        ],
        life: new Range(1.5, 2),
        drag: new Range(3, 3),
        rotVel: new Range(0, Math.PI * 3),
        scale: {
            start: new Range(0.3, 0.3),
            end: new Range(0.2, 0.2),
            lerp: new Range(0, 0.7),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(1.45, 1.95),
        },
        color: function () {
            return 0xffffff;
        },
    },
    sparklyDeath: {
        image: ["part-death-sparkly-01.img", "part-death-sparkly-02.img"],
        life: new Range(0.75, 1.75),
        drag: new Range(5.0, 9.0),
        rotVel: new Range(0, Math.PI * 3),
        scale: {
            start: new Range(0.12, 0.2),
            end: new Range(0.15, 0.25),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.95, 1),
        },
        color: function () {
            return 0xffffff;
        },
    },
    potatoBlastDeath: {
        image: ["part-death-potato-blast-01.img"],
        life: new Range(0.75, 1.5),
        drag: new Range(5.0, 15.0),
        rotVel: new Range(0, Math.PI * 3),
        scale: {
            start: new Range(0.07, 0.15),
            end: new Range(0.07, 0.15),
            lerp: new Range(0, 0.7),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.95, 1),
        },
        color: function () {
            return 0xffffff;
        },
    },
    toonBlastDeath: {
        image: [
            "part-frag-burst-01.img",
            "part-frag-burst-02.img",
            "part-frag-burst-03.img",
        ],
        life: new Range(0.6, 1.0),
        drag: new Range(3, 6),
        rotVel: new Range(Math.PI * 2, Math.PI * 4),
        scale: {
            start: new Range(0.1, 0.18),
            end: new Range(0.15, 0.25),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.85, 1),
        },
        color: function () {
            const colors = [0xff6b35, 0xffcc00, 0xff3366];
            return colors[Math.floor(util.random(0, colors.length))];
        },
    },
    cupidDeath: {
        image: ["part-cupid-01.img", "part-cupid-02.img", "part-cupid-03.img"],
        life: new Range(1.0, 1.5),
        drag: new Range(1.0, 10.0),
        rotVel: new Range(0, Math.PI * 3),
        scale: {
            start: new Range(0.15, 0.25),
            end: new Range(0.12, 0.2),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.95, 1),
        },
        color: function () {
            return 0xffffff;
        },
    },
    blackHoleDeath: {
        image: ["part-death-black-hole-01.img"],
        life: new Range(1.2, 1.8),
        drag: new Range(0.5, 2.0),
        rotVel: new Range(Math.PI * 2, Math.PI * 4),
        scale: {
            start: new Range(0.1, 0.2),
            end: new Range(0.3, 0.5),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.8, 1),
        },
        color: function () {
            return 0x330066;
        },
    },
    magicSparkDeath: {
        image: [
            "part-death-magic-spark-01.img",
            "part-death-magic-spark-02.img",
            "part-death-magic-spark-03.img",
            "part-death-magic-spark-04.img",
        ],
        life: new Range(1.0, 1.5),
        drag: new Range(5.0, 10.0),
        rotVel: new Range(0, Math.PI * 3),
        scale: {
            start: new Range(0.15, 0.25),
            end: new Range(0.12, 0.2),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.95, 1),
        },
        color: function () {
            return 0xffffff;
        },
    },
    billionaireDeath: {
        image: [
            "part-death-billionaire-01.img",
            "part-death-billionaire-02.img",
            "part-death-billionaire-03.img",
        ],
        life: new Range(1.0, 1.5),
        drag: new Range(4.0, 10.0),
        rotVel: new Range(0, Math.PI * 3),
        scale: {
            start: new Range(0.15, 0.25),
            end: new Range(0.1, 0.175),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.95, 1),
        },
        color: function () {
            return 0xffffff;
        },
    },
    whiteChip: createChip({
        drag: new Range(1, 10),
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.97, 0, util.random(0.95, 0.97)));
        },
    }),
    whitePlank: createPlank({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.97, 0, util.random(0.95, 0.97)));
        },
    }),
    windowBreak: createGlassBreak({
        scale: {
            start: new Range(0.07, 0.12),
        },
    }),
    woodChip: createWoodChip({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.05, 1, util.random(0.35, 0.45)));
        },
    }),
    woodLog: createPlank({
        image: ["part-log-01.img"],
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.05, 1, util.random(0.35, 0.45)));
        },
    }),
    grayLog: createPlank({
        image: ["part-log-01.img"],
        color: function () {
            return util.rgbToInt(
                util.hsvToRgb(0.08, util.random(0.15, 0.45), util.random(0.2, 0.4)),
            );
        },
    }),
    woodPlank: createPlank({}),
    woodShard: createPlank({
        image: ["part-spark-01.img"],
        drag: new Range(3, 5),
        scale: {
            start: new Range(0.06, 0.15),
            end: new Range(0.02, 0.1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.05, 1, util.random(0.25, 0.35)));
        },
    }),
    "9mm": createCasing({}),
    "9mm_cursed": createCasing({}),
    "762mm": createCasing({
        image: ["part-shell-02.img"],
        life: new Range(0.75, 1),
        drag: new Range(1.5, 2.5),
        rotVel: new Range(Math.PI * 2.5, Math.PI * 2.5),
        scale: {
            start: 0.075,
            end: 0.045,
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.925, 1),
        },
    }),
    "556mm": createCasing({
        image: ["part-shell-04.img"],
        life: new Range(0.75, 1),
        drag: new Range(1.5, 2.5),
        rotVel: new Range(Math.PI * 2.5, Math.PI * 2.5),
        scale: {
            start: 0.075,
            end: 0.045,
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.925, 1),
        },
    }),
    "12gauge": createCasing({
        image: ["part-shell-03.img"],
        drag: new Range(1, 2),
        rotVel: new Range(Math.PI * 3, Math.PI * 3),
        scale: {
            start: 0.1,
            end: 0.05,
            lerp: new Range(0, 1),
        },
    }),
    "50AE": createCasing({}),
    "308sub": createCasing({
        image: ["part-shell-05.img"],
    }),
    flare: createCasing({
        image: ["part-shell-03.img"],
        drag: new Range(1, 2),
        scale: {
            start: 0.1,
            end: 0.05,
        },
    }),
    "45acp": createCasing({
        scale: {
            start: 0.07,
            end: 0.04,
            lerp: new Range(0, 1),
        },
    }),
    "40mm": createCasing({
        image: ["part-40mm-01.img"],
        scale: {
            start: 0.2,
            end: 0.09,
        },
        color: 0xffffff,
    }),
    potato_ammo: createCasing({
        image: ["part-wedge-01.img"],
        scale: {
            start: 0.07,
            end: 0.04,
            lerp: new Range(0, 1),
        },
        color: 0xffffff,
    }),
    heart_ammo: createCasing({
        image: ["part-heart-01.img"],
        life: new Range(0.5, 0.75),
        scale: {
            start: 0.02,
            end: 0.09,
        },
        color: 0xffffff,
    }),
    flux_rifle_ammo: createCasing({
        image: ["part-wedge-01.img"],
        scale: {
            start: 0.07,
            end: 0.04,
        },
        color: 0x00ffff,
    }),
    snow_ammo: createCasing({
        image: ["part-wedge-01.img"],
        scale: {
            start: 0.07,
            end: 0.04,
        },
        color: 0xffffff,
    }),
    rainbow_ammo: createCasing({
        image: [
            "part-rainbow-01.img",
            "part-rainbow-02.img",
            "part-rainbow-03.img",
            "part-rainbow-04.img",
            "part-rainbow-05.img",
            "part-rainbow-06.img",
        ],
        scale: {
            start: 0.45,
            end: 0.1,
        },
        color: 0xffffff,
    }),
    bugle_ammo: {
        image: ["part-note-02.img"],
        life: new Range(1.25, 1.3),
        drag: new Range(3, 4),
        rotVel: new Range(Math.PI * 1, Math.PI * 1),
        scale: {
            start: 0.1,
            end: 0.14,
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.5, 1),
        },
        color: 0xffda00,
    },
    fragPin: {
        image: ["part-frag-pin-01.img"],
        life: new Range(0.5, 0.5),
        drag: new Range(0.9, 1),
        rotVel: 0,
        scale: {
            start: 0.18,
            end: 0.14,
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.5, 1),
        },
        color: 0xffffff,
    },
    fragLever: {
        image: ["part-frag-lever-01.img"],
        life: new Range(0.5, 0.5),
        drag: new Range(0.9, 1),
        rotVel: Math.PI * 9,
        scale: {
            start: 0.18,
            end: 0.14,
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.5, 1),
        },
        color: 0xffffff,
    },
    explosionBurst: createExplosion({}),
    explosionHeartBurst: createExplosion({
        color: 0xd60257,
    }),
    explosionAntiFire: createExplosion({
        color: 0xffffff,
    }),
    explosionMIRV: createExplosion({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 1, util.random(0.82, 0.84)));
        },
    }),
    explosionSmoke: createSmoke({}),
    explosionUSAS: createExplosion({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.08, 1, util.random(0.98, 0.99)));
        },
    }),
    explosionRounds: createExplosion({
        image: ["part-frag-burst-03.img"],
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.08, 0.7, util.random(0.75, 0.8)));
        },
    }),
    explosionBomb: createExplosion({
        image: ["part-frag-burst-02.img"],
        color: 0xffffff,
    }),
    explosionMotherShip: createExplosion({
        image: ["part-lightning-burst-01.img"],
        color: 0x9bff99,
    }),
    explosionPotato: createExplosion({
        color: 0xad661a,
    }),
    explosionHeart: createExplosion({
        color: 0xfd6ba5,
    }),
    explosionSnow: createExplosion({
        image: ["part-frag-burst-01.img"],
    }),
    explosionPotatoSMG: createExplosion({
        color: 0xc4a80a,
    }),
    airdropSmoke: createSmoke({
        image: ["part-smoke-02.img", "part-smoke-03.img"],
        zOrd: 499,
        life: new Range(1, 1.5),
        scale: {
            start: new Range(0.67, 0.72),
            end: new Range(0.55, 0.61),
            lerp: new Range(0, 1),
        },
    }),
    vehicleTireSmoke: {
        image: ["part-smoke-02.img", "part-smoke-03.img"],
        zOrd: 21,
        life: new Range(0.65, 1.05),
        drag: new Range(1.6, 2.2),
        rotVel: new Range(-Math.PI * 0.35, Math.PI * 0.35),
        scale: {
            start: new Range(0.12, 0.18),
            end: new Range(0.42, 0.62),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 0.52,
            end: 0,
            lerp: new Range(0.15, 1),
        },
        alphaIn: {
            start: 0,
            end: 0.52,
            lerp: new Range(0, 0.12),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.72, 0.86)));
        },
    },
    vehicleExhaustFlame: {
        image: ["part-fire-01.img", "part-fire-02.img", "part-fire-03.img"],
        zOrd: 21,
        life: new Range(0.1, 0.17),
        drag: new Range(5, 8),
        rotVel: new Range(-Math.PI * 0.3, Math.PI * 0.3),
        scale: {
            start: new Range(0.2, 0.29),
            end: new Range(0.035, 0.07),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 0.95,
            end: 0,
            lerp: new Range(0.28, 1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(util.random(0.055, 0.105), 0.96, 1));
        },
        ignoreValueAdjust: true,
    },
    airdropCrate01: createAirdropPart({}),
    airdropCrate01h: createAirdropPart({
        image: ["part-airdrop-01h.img"],
    }),
    airdropCrate01x: createAirdropPart({
        image: ["part-airdrop-01x.img"],
    }),
    airdropCrate02: createAirdropPart({
        image: ["part-airdrop-02.img"],
        drag: new Range(1.85, 2.15),
        rotVel: new Range(0, Math.PI * 2),
    }),
    airdropCrate02h: createAirdropPart({
        image: ["part-airdrop-02h.img"],
        drag: new Range(1.85, 2.15),
        rotVel: new Range(0, Math.PI * 2),
    }),
    airdropCrate02x: createAirdropPart({
        image: ["part-airdrop-02x.img"],
        drag: new Range(1.85, 2.15),
        rotVel: new Range(0, Math.PI * 2),
    }),
    airdropCrate03: createAirdropPart({
        image: ["part-airdrop-03.img"],
    }),
    airdropCrate04: createAirdropPart({
        image: ["part-airdrop-04.img"],
        drag: new Range(1.85, 2.15),
        rotVel: new Range(0, Math.PI * 2),
    }),
    classShell01a: createAirdropPart({
        image: ["part-class-shell-01a.img"],
    }),
    classShell01b: createAirdropPart({
        image: ["part-class-shell-01b.img"],
        drag: new Range(1.85, 2.15),
        rotVel: new Range(0, Math.PI * 2),
    }),
    classShell02a: createAirdropPart({
        image: ["part-class-shell-02a.img"],
    }),
    classShell02b: createAirdropPart({
        image: ["part-class-shell-02b.img"],
        drag: new Range(1.85, 2.15),
        rotVel: new Range(0, Math.PI * 2),
    }),
    classShell03a: createAirdropPart({
        image: ["part-class-shell-03a.img"],
    }),
    classShell03b: createAirdropPart({
        image: ["part-class-shell-03b.img"],
        drag: new Range(1.85, 2.15),
    }),
    cabinSmoke: {
        image: ["part-smoke-02.img", "part-smoke-03.img"],
        life: new Range(3, 3.25),
        drag: new Range(0.2, 0.22),
        rotVel: new Range(Math.PI * 0.25, Math.PI * 0.5),
        scale: {
            start: new Range(0.2, 0.25),
            end: new Range(0.6, 0.65),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 0.7,
            end: 0,
            lerp: new Range(0.9, 1),
        },
        alphaIn: {
            start: 0,
            end: 0.7,
            lerp: new Range(0, 0.1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.69, 0.695)));
        },
    },
    bathhouseSteam: {
        image: ["part-smoke-02.img", "part-smoke-03.img"],
        life: new Range(10, 12),
        drag: new Range(0.04, 0.06),
        rotVel: new Range(Math.PI * 0.25, Math.PI * 0.5),
        scale: {
            start: new Range(0.2, 0.25),
            end: new Range(0.9, 0.95),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 0.5,
            end: 0,
            lerp: new Range(0.9, 1),
        },
        alphaIn: {
            start: 0,
            end: 0.5,
            lerp: new Range(0, 0.1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.99, 0.995)));
        },
    },
    bunkerBubbles: {
        image: ["player-ripple-01.img"],
        zOrd: 10,
        life: new Range(2.25, 2.5),
        drag: new Range(1.85, 2.15),
        rotVel: new Range(Math.PI * 0.25, Math.PI * 0.5),
        scale: {
            start: new Range(0.2, 0.25),
            end: new Range(0.65, 0.7),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 0.25,
            end: 0,
            lerp: new Range(0.9, 1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.95, 1)));
        },
    },
    waterRipple: {
        image: ["player-ripple-01.img"],
        zOrd: 10,
        life: 1.75,
        drag: 0,
        rotVel: 0,
        scale: {
            start: 0.15,
            exp: 0.5,
        },
        alpha: {
            start: 1,
            exp: -1,
        },
        color: 0xb3f0ff,
    },
    snowFootprint: {
        image: ["part-snow-footprint.img"],
        zOrd: 10,
        life: 3,
        drag: 0,
        rotVel: 0,
        scale: {
            start: 0.34,
            end: 0.34,
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 0.42,
            end: 0,
            lerp: new Range(0.05, 1),
        },
        color: 0x637b86,
        ignoreValueAdjust: true,
    },
    leafAutumn: createAmbientLeaves({}),
    leafHalloween: createAmbientLeaves({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.5, 0.55)));
        },
        ignoreValueAdjust: true,
    }),
    leafSpring: createAmbientLeaves({
        image: [
            "part-blossom-01.img",
            "part-blossom-02.img",
            "part-blossom-03.img",
            "part-blossom-04.img",
        ],
        scale: {
            start: new Range(0.13, 0.15),
        },
    }),
    leafSummer: createAmbientLeaves({
        image: ["part-leaf-06.img"],
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.7, 0.95)));
        },
        ignoreValueAdjust: true,
    }),
    leafPotato: createAmbientLeaves({
        image: [
            "part-blossom-01.img",
            "part-blossom-02.img",
            "part-blossom-03.img",
            "part-blossom-04.img",
            "part-potato-02.img",
        ],
        scale: {
            start: new Range(0.13, 0.15),
        },
    }),
    potato: createAmbientLeaves({
        image: ["part-potato-02.img"],
        scale: {
            start: new Range(0.13, 0.15),
        },
    }),
    snow: createAmbientLeaves({
        image: ["part-snow-01.img"],
        scale: {
            start: new Range(0.07, 0.12),
            end: new Range(0.05, 0.1),
        },
    }),
    volcanicAsh: createAmbientLeaves({
        image: ["part-snow-01.img"],
        scale: {
            start: new Range(0.07, 0.15),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0, 0, util.random(0, 0.5)));
        },
    }),
    snowball_impact: createThrowableImpact({}),
    potato_impact: createThrowableImpact({
        image: ["part-potato-01.img"],
    }),
    snow_impact: createThrowableImpact({}),
    potato_smg_impact: createThrowableImpact({
        image: ["part-potato-01.img"],
        color: 0xffe585,
    }),
    heart_impact: createThrowableImpact({
        image: ["part-potato-01.img"],
        color: function color() {
            return util.rgbToInt(util.hsvToRgb(0.0, 1.0, util.random(0.7, 1.0)));
        },
    }),
    fire_impact: createThrowableImpact({
        image: ["part-potato-01.img"],
        scale: {
            start: new Range(0.1, 0.22),
            end: new Range(0.03, 0.11),
        },
        color: 0xfa4d03,
    }),
    coconut_impact: createThrowableImpact({
        image: ["part-coconut-01.img", "part-coconut-02.img", "part-coconut-03.img"],
    }),

    heal_basic: createHeal({}),
    heal_heart: createHeal({
        image: ["part-heal-heart.img"],
    }),
    heal_moon: createHeal({
        image: ["part-heal-moon.img"],
    }),
    heal_tomoe: createHeal({
        image: ["part-heal-tomoe.img"],
        rotVel: new Range(Math.PI * 0.5, Math.PI * 1),
    }),
    boost_basic: createBoost({}),
    boost_star: createBoost({
        image: ["part-boost-star.img"],
    }),
    boost_naturalize: createBoost({
        image: ["part-boost-naturalize.img"],
        rotVel: new Range(Math.PI * 0.35, Math.PI * 0.7),
    }),
    boost_shuriken: createBoost({
        image: ["part-boost-shuriken.img"],
        rotVel: new Range(Math.PI * 1, Math.PI * 2),
    }),
    revive_basic: createHeal({
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.83, 1, util.random(0.7, 1)));
        },
    }),
    burning: createHeal({
        image: ["part-burning.img"],
        drag: 0,
        rotVel: new Range(Math.PI * 0.25, Math.PI * 0.5),
        scale: {
            start: new Range(0.15, 0.17),
            end: new Range(0.09, 0.11),
            lerp: new Range(0, 1),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.07, 1, util.random(0.7, 1)));
        },
        ignoreValueAdjust: true,
    }),
    poison_gas: {
        image: [
            "part-foam-01.img",
            "part-foam-02.img",
            "part-foam-03.img",
            "part-foam-04.img",
            "part-foam-05.img",
        ],
        life: new Range(1.5, 2.25),
        drag: 4,
        rotVel: new Range(Math.PI * 0.15, Math.PI * 0.35),
        scale: {
            start: new Range(0.035, 0.07),
            end: new Range(0.025, 0.055),
            lerp: new Range(0, 1),
        },
        alpha: {
            start: 0.42,
            end: 0,
            lerp: new Range(0.7, 1),
        },
        alphaIn: {
            start: 0,
            end: 0.42,
            lerp: new Range(0, 0.05),
        },
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.3, 0.9, util.random(0.45, 0.68)));
        },
        ignoreValueAdjust: true,
    },
    water_balloon_impact: createThrowableImpact({
        image: ["part-wet-01.img", "part-wet-02.img", "part-wet-03.img"],
        scale: {
            start: new Range(0.1024, 0.1376),
            end: new Range(0.0192, 0.0416),
        },
        alphaIn: {
            start: 0,
            end: 1,
            lerp: new Range(0, 0.05),
        },
        color: 0x3576c8,
        ignoreValueAdjust: true,
    }),
    village_ninja_trail: createSkinTrail({}),
    paladinParticle: createSkinTrail({
        image: ["part-armor-shines-01.img", "part-armor-shines-02.img"],
    }),
    crownParticle: createSkinTrail({
        image: ["part-armor-crown-01.img", "part-armor-crown-02.img"],
    }),
    silverParticle: createSkinTrail({
        image: ["part-armor-silver-01.img", "part-armor-silver-02.img"],
    }),
    bronzeParticle: createSkinTrail({
        image: ["part-armor-bronze-01.img", "part-armor-bronze-02.img"],
    }),
    diamondParticle: createSkinTrail({
        image: ["part-armor-diamond-01.img", "part-armor-diamond-02.img"],
    }),
    leafStim: createStim({}),
    takedownStim: createStim({
        image: ["part-takedown-01.img"],
        color: 0xc80000,
    }),
    heartPullStim: createStim({
        image: ["proj-heart-01.img"],
        life: new Range(1.5, 2.5),
        rotVel: new Range(Math.PI * 0.25, Math.PI * 0.5),
        scale: {
            start: new Range(0.1, 0.14),
            end: new Range(0.04, 0.06),
        },
        alpha: {
            start: 1,
            end: 0,
            lerp: new Range(0.6, 1),
        },
        color: 0xff003c,
    }),
    inspireStim: createStim({
        image: ["part-note-01.img"],
        color: function () {
            return util.rgbToInt(util.hsvToRgb(0.13, 1, util.random(0.98, 1)));
        },
    }),
    xp_common: createStim({
        image: ["part-boost-basic.img"],
        life: new Range(0.75, 1),
        color: function () {
            if (Math.random() > 0.5) {
                return util.rgbToInt(util.hsvToRgb(0.12, 0.97, util.random(0.95, 1)));
            }
            return util.rgbToInt(util.hsvToRgb(0.16, 1, util.random(0.95, 1)));
        },
        ignoreValueAdjust: true,
    }),
    xp_rare: createStim({
        image: ["part-boost-basic.img"],
        life: new Range(0.75, 1),
        color: function () {
            if (Math.random() > 0.5) {
                return util.rgbToInt(util.hsvToRgb(0.05, 0.94, util.random(0.85, 0.88)));
            }
            return util.rgbToInt(util.hsvToRgb(0.06, 0.95, util.random(0.95, 1)));
        },
        ignoreValueAdjust: true,
    }),
    xp_mythic: createStim({
        image: ["part-boost-basic.img"],
        life: new Range(0.75, 1),
        color: function () {
            if (Math.random() > 0.5) {
                return util.rgbToInt(util.hsvToRgb(0, 0.96, util.random(0.91, 0.94)));
            }
            return util.rgbToInt(util.hsvToRgb(0.03, 0.95, util.random(0.92, 0.95)));
        },
        ignoreValueAdjust: true,
    }),
};

function createAmbientLeafEmitter(overrides: DeepPartial<EmitterDef>): EmitterDef {
    const baseDef: EmitterDef = {
        particle: "leafAutumn",
        rate: new Range(0.08, 0.12),
        radius: 120,
        speed: new Range(2, 3),
        angle: Math.PI * 0.2,
        rot: new Range(0, Math.PI * 2),
        maxCount: Number.MAX_VALUE,
        zOrd: 999,
    };
    return util.mergeDeep(baseDef, overrides);
}

function createHealEmitter(overrides: DeepPartial<EmitterDef>): EmitterDef {
    const baseDef: EmitterDef = {
        particle: "heal_basic",
        rate: new Range(0.3, 0.35),
        radius: 1.5,
        speed: new Range(1, 1.5),
        angle: 0,
        rot: new Range(0, 0),
        maxCount: Number.MAX_VALUE,
    };
    return util.mergeDeep(baseDef, overrides);
}

function createBoostEmitter(overrides: DeepPartial<EmitterDef>): EmitterDef {
    const baseDef = createHealEmitter({
        particle: "boost_basic",
        rot: new Range(0, Math.PI * 2),
    });
    return util.mergeDeep(baseDef, overrides);
}

function createSkinTrailEmitter(overrides: DeepPartial<EmitterDef>): EmitterDef {
    const baseDef: EmitterDef = {
        particle: "village_ninja_trail",
        rate: new Range(0.22, 0.32),
        radius: 1.35,
        speed: new Range(0.15, 0.45),
        angle: Math.PI * 2,
        rot: new Range(0, Math.PI * 2),
        maxCount: Number.MAX_VALUE,
    };
    return util.mergeDeep(baseDef, overrides);
}

const EmitterDefs: Record<string, EmitterDef> = {
    smoke_barrel: {
        particle: "explosionSmoke",
        rate: new Range(0.2, 0.3),
        radius: 0,
        speed: new Range(2, 3),
        angle: Math.PI * 0.1,
        rot: new Range(0, Math.PI * 2),
        maxCount: Number.MAX_VALUE,
    },
    cabin_smoke_parent: {
        particle: "cabinSmoke",
        rate: new Range(0.72, 0.83),
        radius: 0,
        speed: new Range(64, 96),
        angle: Math.PI * 0.1,
        rot: new Range(0, Math.PI * 2),
        maxCount: Number.MAX_VALUE,
    },
    campfire_smoke: {
        particle: "cabinSmoke",
        rate: new Range(2, 4),
        radius: 0,
        speed: new Range(1, 1.5),
        angle: Math.PI * 0.1,
        rot: new Range(0, Math.PI * 2),
        maxCount: Number.MAX_VALUE,
    },
    bathhouse_steam: {
        particle: "bathhouseSteam",
        rate: new Range(2, 3),
        radius: 1,
        speed: new Range(1.5, 2),
        angle: Math.PI * 0.1,
        maxCount: Number.MAX_VALUE,
    },
    bunker_bubbles_01: {
        particle: "bunkerBubbles",
        rate: new Range(0.3, 0.325),
        radius: 0,
        speed: new Range(1.6, 1.8),
        angle: Math.PI * -2.2,
        rot: new Range(0, Math.PI * 2),
        maxCount: Number.MAX_VALUE,
    },
    bunker_bubbles_02: {
        particle: "bunkerBubbles",
        rate: new Range(0.4, 0.425),
        radius: 0,
        speed: new Range(1.6, 1.8),
        angle: Math.PI * -2.2,
        rot: new Range(0, Math.PI * 2),
        maxCount: Number.MAX_VALUE,
    },
    falling_leaf: createAmbientLeafEmitter({}),
    falling_leaf_halloween: createAmbientLeafEmitter({
        particle: "leafHalloween",
    }),
    falling_leaf_spring: createAmbientLeafEmitter({
        particle: "leafSpring",
        rate: new Range(0.1, 0.14),
    }),
    falling_leaf_summer: createAmbientLeafEmitter({
        particle: "leafSummer",
        rate: new Range(0.18, 0.24),
        speed: new Range(1.4, 2.4),
        rot: 0,
    }),
    falling_leaf_potato: createAmbientLeafEmitter({
        particle: "leafPotato",
        rate: new Range(0.1, 0.14),
    }),
    falling_potato: createAmbientLeafEmitter({
        particle: "potato",
        rate: new Range(0.2, 0.24),
    }),
    falling_snow_fast: createAmbientLeafEmitter({
        particle: "snow",
        rate: new Range(0.12, 0.17),
        maxRate: new Range(0.05, 0.07),
        maxElapsed: 240,
        radius: 70,
        speed: new Range(1, 1.5),
    }),
    falling_snow_slow: createAmbientLeafEmitter({
        particle: "snow",
        radius: 70,
        speed: new Range(1, 1.5),
    }),
    falling_volcanic_ash: createAmbientLeafEmitter({
        particle: "volcanicAsh",
        rate: new Range(0.01, 0.02),
        speed: new Range(1, 12),
    }),
    heal_basic: createHealEmitter({}),
    heal_heart: createHealEmitter({
        particle: "heal_heart",
    }),
    heal_moon: createHealEmitter({
        particle: "heal_moon",
    }),
    heal_tomoe: createHealEmitter({
        particle: "heal_tomoe",
    }),
    boost_basic: createBoostEmitter({}),
    boost_star: createBoostEmitter({
        particle: "boost_star",
    }),
    boost_naturalize: createBoostEmitter({
        particle: "boost_naturalize",
    }),
    boost_shuriken: createBoostEmitter({
        particle: "boost_shuriken",
    }),
    revive_basic: createHealEmitter({
        rate: new Range(0.5, 0.55),
    }),
    burning: createBoostEmitter({
        particle: "burning",
        rate: new Range(0.2, 0.4),
    }),
    poison_gas: createBoostEmitter({
        particle: "poison_gas",
        rate: new Range(0.12, 0.22),
        speed: new Range(0.25, 0.65),
    }),
    village_ninja_trail: createSkinTrailEmitter({}),
    paladinParticle: createSkinTrailEmitter({
        particle: "paladinParticle",
    }),
    crownParticle: createSkinTrailEmitter({
        particle: "crownParticle",
    }),
    silverParticle: createSkinTrailEmitter({
        particle: "silverParticle",
    }),
    bronzeParticle: createSkinTrailEmitter({
        particle: "bronzeParticle",
    }),
    diamondParticle: createSkinTrailEmitter({
        particle: "diamondParticle",
    }),
    windwalk: createHealEmitter({
        particle: "leafStim",
        rate: new Range(0.1, 0.12),
    }),
    dash_wind: createHealEmitter({
        particle: "leaf",
        rate: new Range(0.05, 0.06),
        maxCount: 6,
    }),
    takedown: createHealEmitter({
        particle: "takedownStim",
        rate: new Range(0.1, 0.12),
    }),
    heart_pull: createBoostEmitter({
        particle: "heartPullStim",
        rate: new Range(0.08, 0.1),
    }),
    inspire: createHealEmitter({
        particle: "inspireStim",
    }),
    xp_common: createHealEmitter({
        particle: "xp_common",
    }),
    xp_rare: createHealEmitter({
        particle: "xp_rare",
    }),
    xp_mythic: createHealEmitter({
        particle: "xp_mythic",
    }),
};

export interface ParticleDef {
    image: string[];
    zOrd?: number;
    life: RangeNumber;
    drag: RangeNumber;
    rotVel: RangeNumber;
    scale: {
        start: RangeNumber;
        end?: RangeNumber;
        lerp?: RangeNumber;
        exp?: number;
    };
    alpha: {
        start: number;
        end?: number;
        lerp?: Range;
        exp?: number;
    };
    alphaIn?: {
        start: number;
        end?: number;
        lerp?: Range;
        exp?: number;
    };
    color?: number | (() => number);
    ignoreValueAdjust?: boolean;
}
type RangeNumber = Range | number;

export interface EmitterDef {
    particle: string;
    rate: Range;
    radius: number;
    speed: Range;
    angle: number;
    rot?: RangeNumber;
    maxCount: number;
    maxRate?: Range;
    maxElapsed?: number;
    zOrd?: number;
}
