import * as PIXI from "pixi.js-legacy";
import type { ObjectData, ObjectType } from "../../../shared/net/objectSerializeFns";
import { collider } from "../../../shared/utils/collider";
import { math } from "../../../shared/utils/math";
import { util } from "../../../shared/utils/util";
import { type Vec2, v2 } from "../../../shared/utils/v2";
import type { Camera } from "../camera";
import type { Ctx } from "../game";
import type { Map } from "../map";
import type { Renderer } from "../renderer";
import { Pool } from "./objectPool";
import type { AbstractObject, Player } from "./player";

class Smoke implements AbstractObject {
    __id!: number;
    __type!: ObjectType.Smoke;
    active!: boolean;

    m_particle!: SmokeParticle | null;
    m_pos!: Vec2;
    m_rad!: number;
    m_layer!: number;
    m_interior!: number;
    m_isFoam!: boolean;
    m_isPoison!: boolean;

    m_init() {}
    m_free() {
        this.m_particle!.fadeOut();
        this.m_particle = null;
    }

    m_updateData(
        data: ObjectData<ObjectType.Smoke>,
        fullUpdate: boolean,
        isNew: boolean,
        ctx: Ctx,
    ) {
        this.m_pos = v2.copy(data.pos);
        this.m_rad = data.rad;

        if (fullUpdate) {
            this.m_layer = data.layer;
            this.m_interior = data.interior;
            this.m_isFoam = data.isFoam;
            this.m_isPoison = data.isPoison;
        }

        if (isNew) {
            this.m_particle = ctx.smokeBarn.m_allocParticle();
            this.m_particle?.m_init(
                this.m_pos,
                this.m_rad,
                this.m_layer,
                this.m_interior,
                this.m_isFoam,
                this.m_isPoison,
            );
        }
        this.m_particle!.posTarget = v2.copy(this.m_pos);
        this.m_particle!.radTarget = this.m_rad;
    }
}

const smokeParticles = ["part-smoke-02.img", "part-smoke-03.img"];
const foamParticles = [
    "foam1.img",
    "foam2.img",
    "foam3.img",
    "foam4.img",
    "foam5.img",
    "foam6.img",
    "foam7.img",
    "foam8.img",
    "foam9.img",
    "foam10.img",
    "foam11.img",
    "foam12.img",
];
export class SmokeParticle {
    active = false;
    zIdx = 0;
    sprite = PIXI.Sprite.from(
        smokeParticles[Math.floor(Math.random() * smokeParticles.length)],
    );

    pos!: Vec2;
    posTarget!: Vec2;
    rad!: number;
    radTarget!: number;

    rot!: number;
    rotVel!: number;
    fade!: boolean;
    fadeTicker!: number;
    fadeDuration!: number;
    tint!: number;
    layer!: number;
    interior!: number;
    isFoam!: boolean;
    isPoison!: boolean;
    poisonDots: Array<{
        sprite: PIXI.Sprite;
        offset: Vec2;
        ticker: number;
        life: number;
        rise: number;
        scale: number;
    }> = [];

    constructor() {
        this.sprite.anchor = new PIXI.Point(0.5, 0.5) as PIXI.ObservablePoint;
        this.sprite.visible = false;
    }

    m_init(
        pos: Vec2,
        rad: number,
        layer: number,
        interior: number,
        isFoam: boolean = false,
        isPoison: boolean = false,
    ) {
        this.pos = v2.copy(pos);
        this.posTarget = v2.copy(this.pos);
        this.rad = rad;
        this.radTarget = this.rad;
        this.rot = util.random(0, Math.PI * 2);
        this.rotVel = Math.PI * util.random(0.25, 0.5) * (Math.random() < 0.5 ? -1 : 1);
        this.fade = false;
        this.fadeTicker = 0;
        this.fadeDuration = util.random(0.5, 0.75);
        this.isFoam = isFoam;
        this.isPoison = isPoison;
        for (const dot of this.poisonDots) {
            dot.sprite.visible = false;
        }
        if (isFoam) {
            const foamImg =
                foamParticles[Math.floor(Math.random() * foamParticles.length)];
            this.sprite.texture = PIXI.Texture.from(foamImg);
            this.tint = 0x00ffffff;
        } else if (isPoison) {
            const foamImg =
                foamParticles[Math.floor(Math.random() * foamParticles.length)];
            this.sprite.texture = PIXI.Texture.from(foamImg);
            this.tint = util.rgbToInt(util.hsvToRgb(0.3, 0.9, util.random(0.45, 0.68)));
            if (this.poisonDots.length === 0) {
                for (let i = 0; i < 120; i++) {
                    const sprite = PIXI.Sprite.from("foam1.img");
                    sprite.anchor.set(0.5, 0.5);
                    this.poisonDots.push({
                        sprite,
                        offset: util.randomPointInCircle(1),
                        ticker: util.random(0, 1.6),
                        life: util.random(1.1, 1.6),
                        rise: util.random(0.35, 0.8),
                        scale: util.random(0.035, 0.07),
                    });
                }
            }
        } else {
            const smokeImg =
                smokeParticles[Math.floor(Math.random() * smokeParticles.length)];
            this.sprite.texture = PIXI.Texture.from(smokeImg);
            this.tint = util.rgbToInt(util.hsvToRgb(0, 0, util.random(0.9, 0.95)));
        }
        this.layer = layer;
        this.interior = interior;
    }

    fadeOut() {
        this.fade = true;
    }
}
export class SmokeBarn {
    m_smokePool = new Pool(Smoke);
    m_particles: SmokeParticle[] = [];
    zIdx = 2147483647;

    m_allocParticle() {
        let particle = null;
        for (let i = 0; i < this.m_particles.length; i++) {
            if (!this.m_particles[i].active) {
                particle = this.m_particles[i];
                break;
            }
        }
        if (!particle) {
            particle = new SmokeParticle();
            this.m_particles.push(particle);
        }
        particle.active = true;
        particle.zIdx = this.zIdx--;
        return particle;
    }

    m_update(
        dt: number,
        camera: Camera,
        activePlayer: Player,
        map: Map,
        renderer: Renderer,
    ) {
        // why is this commented out?
        // for (let o = this.e.getPool(), s = 0; s < o.length; s++) {
        // o[s].active;
        // }

        // Update visual particles
        for (let m = 0; m < this.m_particles.length; m++) {
            const p = this.m_particles[m];
            if (p.active) {
                p.rad = math.lerp(dt * 3, p.rad, p.radTarget);
                p.pos = math.v2lerp(dt * 3, p.pos, p.posTarget);
                p.rotVel *= 1 / (1 + dt * 0.1);
                p.rot += p.rotVel * dt;
                p.fadeTicker += p.fade ? dt : 0;
                p.active = p.fadeTicker < p.fadeDuration;

                const kDefaultAlpha = p.isFoam ? 0.4 : p.isPoison ? 0.38 : 0.9;
                const fadeAlpha = math.clamp(1 - p.fadeTicker / p.fadeDuration, 0, 1);
                const alpha = fadeAlpha * kDefaultAlpha;

                // Always add to the top layer if visible and not occluded by
                // the layer mask (fixes issue of smokes spawning on the ground
                // level but occluded by the cellar when on the stairs).
                let layer = p.layer;
                if (
                    (!!util.sameLayer(p.layer, activePlayer.layer) ||
                        !!(activePlayer.layer & 2)) &&
                    (p.layer == 1 ||
                        !(activePlayer.layer & 2) ||
                        !map.insideStructureMask(collider.createCircle(p.pos, 1)))
                ) {
                    layer |= 2;
                }
                const zOrd = p.isPoison ? 10 : p.interior ? 500 : 1000;
                renderer.addPIXIObj(p.sprite, layer, zOrd, p.zIdx);
                const dotLayer = p.isPoison ? p.layer : layer;

                const screenPos = camera.m_pointToScreen(p.pos);
                const screenScale = camera.m_pixels((p.rad * 2) / camera.m_ppu);

                p.sprite.position.set(screenPos.x, screenPos.y);
                p.sprite.scale.set(screenScale, screenScale);
                p.sprite.rotation = p.rot;
                p.sprite.tint = p.tint;
                p.sprite.alpha = alpha;
                p.sprite.visible = p.active && !p.isPoison;

                for (const dot of p.poisonDots) {
                    if (!p.isPoison || !p.active) {
                        dot.sprite.visible = false;
                        continue;
                    }
                    dot.ticker += dt;
                    if (dot.ticker >= dot.life) {
                        dot.offset = util.randomPointInCircle(1);
                        dot.ticker = 0;
                        dot.life = util.random(1.1, 1.6);
                        dot.rise = util.random(0.35, 0.8);
                        dot.scale = util.random(0.035, 0.07);
                    }
                    const dotT = dot.ticker / dot.life;
                    const dotPos = v2.add(
                        p.pos,
                        v2.add(
                            v2.mul(dot.offset, p.rad * 0.88),
                            v2.create(0, dot.rise * dotT),
                        ),
                    );
                    const dotScreenPos = camera.m_pointToScreen(dotPos);
                    const popT = math.min(dotT / 0.18, 1);
                    const dotScale = camera.m_pixels(
                        dot.scale * math.lerp(popT, 0.35, 1),
                    );
                    renderer.addPIXIObj(dot.sprite, dotLayer, 10, p.zIdx);
                    dot.sprite.position.set(dotScreenPos.x, dotScreenPos.y);
                    dot.sprite.scale.set(dotScale, dotScale);
                    dot.sprite.tint = p.tint;
                    dot.sprite.alpha = Math.sin(dotT * Math.PI) * 0.5 * fadeAlpha;
                    dot.sprite.visible = true;
                }
            }
        }
    }
}
