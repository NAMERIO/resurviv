import * as PIXI from "pixi.js-legacy";
import { type NpcDef, NpcDefs } from "../../../shared/defs/npcDefs";
import type { ObjectData, ObjectType } from "../../../shared/net/objectSerializeFns";
import type { Collider } from "../../../shared/utils/coldet";
import { collider } from "../../../shared/utils/collider";
import { math } from "../../../shared/utils/math";
import { util } from "../../../shared/utils/util";
import { type Vec2, v2 } from "../../../shared/utils/v2";
import type { AudioManager } from "../audioManager";
import type { Camera } from "../camera";
import type { Ctx } from "../game";
import type { SoundHandle } from "../lib/createJS";
import type { Map } from "../map";
import type { Renderer } from "../renderer";
import type { ParticleBarn } from "./particles";
import type { AbstractObject, Player } from "./player";

const SpriteAnimDefs = {
    fusion_motherShip: {
        sprites: [
            "map-spaceship-fusion-01.img",
            "map-spaceship-fusion-02.img",
            "map-spaceship-fusion-03.img",
            "map-spaceship-fusion-04.img",
        ],
        loop: true,
        speed: 7,
        play: true,
    },
    base_motherShip: {
        sprites: ["map-spaceship-01.img"],
        loop: false,
        speed: 10,
        play: false,
    },
    load_motherShip: {
        sprites: [
            "map-loading-blast-01.img",
            "map-loading-blast-02.img",
            "map-loading-blast-03.img",
            "map-loading-blast-04.img",
            "map-loading-blast-05.img",
            "map-loading-blast-06.img",
            "map-loading-blast-07.img",
            "map-loading-blast-08.img",
            "map-loading-blast-09.img",
            "map-loading-blast-10.img",
            "map-loading-blast-11.img",
        ],
        loop: false,
        speed: 30,
        play: true,
    },
    skitter_base: {
        sprites: [
            "skitter-walking-1.img",
            "skitter-walking-2.img",
            "skitter-walking-3.img",
            "skitter-walking-4.img",
        ],
        loop: true,
        speed: 30,
        play: true,
    },
    vehicle_idle: {
        sprites: [] as string[],
        loop: false,
        speed: 0,
        play: false,
    },
    vehicle_drive: {
        sprites: [] as string[],
        loop: false,
        speed: 0,
        play: false,
    },
    none: {
        sprites: [] as string[],
        loop: false,
        speed: 0,
        play: false,
    },
};

const motherShipTravelSpinSpeed = 0.25;
const motherShipAimTurnSpeed = Math.PI * 2;
const vehicleSkidLifetime = 3;
const vehicleSkidSampleInterval = 0.025;
const vehicleSkidMaxSegmentDistance = 2.5;
const vehicleTireTrackHalfWidth = 1.05;

interface VehicleSkidSegment {
    start: Vec2;
    end: Vec2;
    age: number;
}

export class Npc implements AbstractObject {
    __id!: number;
    __type!: ObjectType.Npc;
    active!: boolean;

    sprite = new PIXI.AnimatedSprite([PIXI.Texture.EMPTY]);
    gunSprite = new PIXI.Sprite();
    targetSprite = new PIXI.Sprite();
    skidGraphics = new PIXI.Graphics();
    soundLoadingInstance: SoundHandle | null = null;
    soundChargeLoading: SoundHandle | null = null;
    engineSoundInstance: SoundHandle | null = null;
    brakeSoundCooldown = 0;

    isNew = false;
    exploded = false;
    type = "";
    obstacleType = "";
    layer = 0;
    healthT = 1;
    dead = false;
    teamId = 0;
    posOld = v2.create(0, 0);
    pos = v2.create(0, 0);
    visualPos = v2.create(0, 0);
    visualPosOld = v2.create(0, 0);
    rot = 0;
    visualRot = 0;
    vehicleVisualRot = 0;
    vehicleVisualRotOld = 0;
    vehicleInterpTicker = 0;
    scale = 1;
    speed = 0;
    driftIntensity = 0;
    driftSmokeTicker = 0;
    skidSampleTicker = 0;
    skidSegments: VehicleSkidSegment[] = [];
    skidLastTirePositions: Vec2[] | null = null;
    imgScale = 1;
    collider!: Collider;
    state: string | null = null;
    stepDistance = 0;
    invisibleTicker = false;
    targetActive = false;
    targetPos = v2.create(0, 0);

    constructor() {
        this.sprite.anchor.set(0.5, 0.5);
        this.sprite.visible = false;
        this.gunSprite.texture = PIXI.Texture.EMPTY;
        this.gunSprite.anchor.set(0.5, 0.5);
        this.gunSprite.visible = false;
        this.sprite.addChild(this.gunSprite);
        this.targetSprite.texture = PIXI.Texture.EMPTY;
        this.targetSprite.anchor.set(0.5, 0.5);
        this.targetSprite.tint = 0xffffff;
        this.targetSprite.visible = false;
    }

    m_init() {
        this.isNew = false;
        this.exploded = false;
        this.sprite.visible = false;
        this.gunSprite.visible = false;
        this.targetSprite.visible = false;
        this.targetActive = false;
        this.state = null;
        this.stepDistance = 0;
        this.soundLoadingInstance = null;
        this.soundChargeLoading = null;
        this.engineSoundInstance = null;
        this.brakeSoundCooldown = 0;
        this.driftSmokeTicker = 0;
        this.skidSampleTicker = 0;
        this.skidSegments.length = 0;
        this.skidLastTirePositions = null;
        this.skidGraphics.clear();
        this.skidGraphics.visible = false;
        this.vehicleInterpTicker = 0;
    }

    m_free() {
        this.sprite.visible = false;
        this.gunSprite.visible = false;
        this.targetSprite.visible = false;
        this.skidGraphics.clear();
        this.skidGraphics.visible = false;
        this.skidSegments.length = 0;
        this.skidLastTirePositions = null;
        this.soundLoadingInstance?.stop();
        this.soundChargeLoading?.stop();
        this.engineSoundInstance?.stop();
        this.soundLoadingInstance = null;
        this.soundChargeLoading = null;
        this.engineSoundInstance = null;
    }

    m_updateData(
        data: ObjectData<ObjectType.Npc>,
        fullUpdate: boolean,
        isNew: boolean,
        ctx: Ctx,
    ) {
        if (fullUpdate) {
            this.type = data.type;
            this.obstacleType = data.obstacleType;
            this.layer = data.layer;
            this.healthT = data.healthT;
            this.dead = data.dead;
            this.teamId = data.teamId;
        }

        const def = NpcDefs[this.type];
        if (!def) return;
        const isVehicle = !!def.vehicle;

        if (isNew && !isVehicle) {
            ctx.resourceManager?.loadAtlas("contact");
            this.targetSprite.texture = PIXI.Texture.from("map-target.img");
        }

        if (isVehicle && !isNew) {
            this.visualPosOld = v2.copy(this.visualPos);
            this.vehicleVisualRotOld = this.vehicleVisualRot;
            this.vehicleInterpTicker = 0;
        }
        this.posOld = isNew ? v2.copy(data.pos) : v2.copy(this.pos);
        this.pos = v2.copy(data.pos);
        this.rot = data.ori;
        this.scale = data.scale;
        const previousSpeed = this.speed;
        this.speed = data.speed;
        this.driftIntensity = data.driftIntensity;
        this.imgScale = def.img.scale;
        this.collider = collider.transform(def.collision, this.pos, this.rot, this.scale);
        this.invisibleTicker = data.invisibleTicker;
        this.targetActive = data.targetActive;
        if (data.targetActive) this.targetPos = v2.copy(data.targetPos);
        this.targetSprite.visible = data.targetActive;
        this.sprite.alpha = this.dead ? 0.75 : this.invisibleTicker ? 0.2 : def.img.alpha;

        if (isNew) {
            this.isNew = true;
            this.exploded = ctx.map.deadObstacleIds.includes(this.__id);
            this.visualRot = this.rot;
            this.visualPos = v2.copy(this.pos);
            this.visualPosOld = v2.copy(this.pos);
            this.vehicleVisualRot = this.rot;
            this.vehicleVisualRotOld = this.rot;
        }

        const wasDriving = this.state === "drive";
        const state = def.states.find((candidate) => candidate.name === data.state);
        if (data.state !== this.state) {
            this.setState(def, state?.animation ?? "none");
            this.state = data.state;
            if (isVehicle) {
                if (data.state === "drive" && !wasDriving) {
                    ctx.audioManager.playSound(def.vehicle?.sound.start ?? "", {
                        channel: "sfx",
                        soundPos: this.pos,
                        layer: this.layer,
                    });
                } else if (data.state !== "drive" && wasDriving) {
                    this.engineSoundInstance?.stop();
                    this.engineSoundInstance = null;
                    ctx.audioManager.playSound(def.vehicle?.sound.stop ?? "", {
                        channel: "sfx",
                        soundPos: this.pos,
                        layer: this.layer,
                    });
                }
            }
        }
        if (
            isVehicle &&
            data.state === "drive" &&
            this.brakeSoundCooldown <= 0 &&
            Math.abs(previousSpeed) > 2 &&
            Math.sign(previousSpeed) === Math.sign(this.speed) &&
            Math.abs(previousSpeed) - Math.abs(this.speed) > 0.45
        ) {
            ctx.audioManager.playSound(def.vehicle?.sound.brake ?? "", {
                channel: "sfx",
                soundPos: this.pos,
                layer: this.layer,
                volumeScale: 0.55,
            });
            this.brakeSoundCooldown = 0.45;
        }
    }

    private setState(def: NpcDef, animationName: keyof typeof SpriteAnimDefs) {
        const animation = SpriteAnimDefs[animationName];
        const sprites = this.dead
            ? [def.img.residue]
            : def.vehicle
              ? [def.img.sprite]
              : animation.sprites;
        this.sprite.stop();
        this.sprite.textures =
            sprites.length > 0
                ? sprites.map((sprite) => PIXI.Texture.from(sprite))
                : [PIXI.Texture.EMPTY];
        this.sprite.anchor.set(0.5, 0.5);
        this.sprite.tint = def.img.tint;
        this.sprite.alpha = this.dead ? 0.75 : def.img.alpha;
        this.sprite.visible = sprites.length > 0;
        this.gunSprite.texture = def.gunImg
            ? PIXI.Texture.from(def.gunImg.sprite)
            : PIXI.Texture.EMPTY;
        this.gunSprite.position.set(500, 0);
        this.gunSprite.visible = !this.dead && !!def.gunImg;

        if (!this.dead && animation.play) {
            this.sprite.loop = animation.loop;
            this.sprite.animationSpeed = animation.speed / 100;
            this.sprite.play();
        }
    }

    getInteraction() {
        if (!NpcDefs[this.type]?.vehicle || this.dead) return null;
        return {
            action: this.state === "drive" ? "game-exit" : "game-drive",
            object: "game-sports-car",
        };
    }

    update(
        dt: number,
        map: Map,
        particleBarn: ParticleBarn,
        audioManager: AudioManager,
        activePlayer: Player,
        renderer: Renderer,
        camera: Camera,
    ) {
        this.brakeSoundCooldown = Math.max(0, this.brakeSoundCooldown - dt);
        const def = NpcDefs[this.type];
        if (!def) return;

        if (this.type === "motherShip") {
            if (this.state === "cannon" && this.targetActive) {
                const angleDiff = math.angleDiff(this.visualRot, this.rot);
                const maxTurn = motherShipAimTurnSpeed * dt;
                this.visualRot += math.clamp(angleDiff, -maxTurn, maxTurn);
            } else if (!this.targetActive) {
                this.visualRot += motherShipTravelSpinSpeed * dt;
            }
            this.visualRot = math.fmod(this.visualRot + Math.PI, Math.PI * 2) - Math.PI;

            const intersectsPlayer = collider.intersectCircle(
                this.collider,
                activePlayer.m_pos,
                activePlayer.m_rad,
            );
            this.sprite.alpha = this.invisibleTicker
                ? 0.2
                : intersectsPlayer
                  ? 0.5
                  : this.dead
                    ? 0.75
                    : 1;
            if (
                (!this.soundLoadingInstance ||
                    !audioManager.isSoundPlaying(this.soundLoadingInstance)) &&
                !activePlayer.m_netData.m_dead
            ) {
                this.soundLoadingInstance = audioManager.playSound("mothership_mov_01", {
                    channel: "activePlayer",
                    soundPos: this.pos,
                    fallOff: 3,
                    layer: this.layer,
                    filter: "muffled",
                });
            }
        } else if (this.type === "skitter") {
            this.stepDistance += v2.length(v2.sub(this.posOld, this.pos));
            if (this.stepDistance > 3 && !this.dead && !activePlayer.m_netData.m_dead) {
                this.stepDistance = 0;
                audioManager.playGroup("footstep_skitter", {
                    soundPos: this.pos,
                    fallOff: 3,
                    layer: this.layer,
                    filter: "muffled",
                });
            }
        } else if (def.vehicle) {
            this.vehicleInterpTicker += dt;
            const locallyDriven =
                activePlayer.m_netData.m_vehicleId === this.__id && !activePlayer.isNew;
            if (locallyDriven) {
                this.visualPos = v2.copy(activePlayer.m_visualPos);
            } else if (camera.m_interpEnabled) {
                const interpolationT = math.clamp(
                    this.vehicleInterpTicker / Math.max(camera.m_interpInterval, 0.001),
                    0,
                    1,
                );
                this.visualPos = v2.lerp(interpolationT, this.visualPosOld, this.pos);
            } else {
                this.visualPos = v2.copy(this.pos);
            }
            const rotationT = camera.m_interpEnabled
                ? math.clamp(
                      this.vehicleInterpTicker / Math.max(camera.m_interpInterval, 0.001),
                      0,
                      1,
                  )
                : 1;
            this.vehicleVisualRot =
                this.vehicleVisualRotOld +
                math.angleDiff(this.vehicleVisualRotOld, this.rot) * rotationT;
            this.updateDriftSmoke(dt, particleBarn, def);
            this.updateSkidMarks(dt, camera, renderer, def);

            const driving = this.state === "drive" && !this.dead;
            if (
                driving &&
                (!this.engineSoundInstance ||
                    !audioManager.isSoundPlaying(this.engineSoundInstance))
            ) {
                this.engineSoundInstance = audioManager.playSound(
                    def.vehicle?.sound.loop ?? "",
                    {
                        channel: "sfx",
                        soundPos: this.pos,
                        layer: this.layer,
                        loop: true,
                        volumeScale: 0.7,
                    },
                );
            }
            if (this.engineSoundInstance) {
                audioManager.updateSound(this.engineSoundInstance, "sfx", this.pos, {
                    layer: this.layer,
                    rangeMult: 1.25,
                    volumeScale: driving ? 0.7 : 0,
                });
                const speedT = math.clamp(
                    Math.abs(this.speed) / (def.vehicle?.maxForwardSpeed ?? 26),
                    0,
                    1,
                );
                this.engineSoundInstance.detune = -180 + speedT * 720;
            }
            if (!driving && this.engineSoundInstance) {
                this.engineSoundInstance.stop();
                this.engineSoundInstance = null;
            }
        }

        if (this.dead && !this.exploded) {
            map.deadObstacleIds.push(this.__id);
            this.exploded = true;
            if (!this.isNew) {
                const aabb = collider.toAabb(this.collider);
                const extent = v2.mul(v2.sub(aabb.max, aabb.min), 0.5);
                const center = v2.add(aabb.min, extent);
                const particleCount = Math.floor(util.random(5, 11));
                for (let i = 0; i < particleCount; i++) {
                    const velocity = v2.mul(v2.randomUnit(), util.random(5, 15));
                    particleBarn.addParticle(
                        def.explodeParticle,
                        this.layer,
                        center,
                        velocity,
                    );
                }
                if (this.type === "skitter") {
                    audioManager.playSound("skitter_destroy_01", {
                        channel: "sfx",
                        soundPos: center,
                        layer: this.layer,
                        filter: "muffled",
                    });
                }
            }
        }

        if (this.sprite.visible && this.state) {
            let zOrd = this.dead ? 5 : def.img.zIdx;
            let layer = this.layer;
            if (
                !this.dead &&
                zOrd >= 50 &&
                this.layer === 0 &&
                activePlayer.layer === 0
            ) {
                zOrd += 100;
                layer |= 2;
            }
            renderer.addPIXIObj(
                this.sprite,
                layer,
                zOrd,
                Math.floor(this.scale * 1000) * 65535 + this.__id,
            );

            if (this.targetSprite.visible) {
                renderer.addPIXIObj(
                    this.targetSprite,
                    this.layer,
                    31,
                    this.__id + 524288,
                );
            }

            if (
                this.state === "cannon" &&
                (!this.soundChargeLoading ||
                    !audioManager.isSoundPlaying(this.soundChargeLoading)) &&
                !activePlayer.m_netData.m_dead
            ) {
                this.soundChargeLoading = audioManager.playSound("mothership_reload_01", {
                    channel: "activePlayer",
                    soundPos: this.pos,
                    fallOff: 3,
                    layer: this.layer,
                    filter: "muffled",
                });
            }
        }

        this.isNew = false;
    }

    render(camera: Camera) {
        const isVehicle = !!NpcDefs[this.type]?.vehicle;
        const renderPos = isVehicle ? this.visualPos : this.pos;
        const screenPos = camera.m_pointToScreen(renderPos);
        const screenScale = camera.m_pixels(this.scale * this.imgScale);
        this.sprite.position.set(screenPos.x, screenPos.y);
        this.sprite.scale.set(screenScale, screenScale);
        this.sprite.rotation =
            this.type === "motherShip"
                ? -this.visualRot
                : isVehicle
                  ? -this.vehicleVisualRot + Math.PI * 0.5
                  : -this.rot;

        if (this.targetActive) {
            const targetScreenPos = camera.m_pointToScreen(this.targetPos);
            const targetScreenScale = camera.m_pixels(0.5);
            this.targetSprite.position.set(targetScreenPos.x, targetScreenPos.y);
            this.targetSprite.scale.set(targetScreenScale, targetScreenScale);
            this.targetSprite.rotation = 0;
        }
    }

    private updateDriftSmoke(dt: number, particleBarn: ParticleBarn, def: NpcDef) {
        const drift = def.vehicle?.drift;
        if (
            !drift ||
            this.dead ||
            this.state !== "drive" ||
            this.driftIntensity < drift.smokeThreshold ||
            Math.abs(this.speed) < drift.minSpeed
        ) {
            this.driftSmokeTicker = 0;
            return;
        }

        this.driftSmokeTicker -= dt;
        if (this.driftSmokeTicker > 0) return;
        this.driftSmokeTicker = math.lerp(this.driftIntensity, 0.09, 0.025);

        const forward = v2.create(
            Math.cos(this.vehicleVisualRot),
            Math.sin(this.vehicleVisualRot),
        );
        const side = v2.perp(forward);
        const rearCenter = v2.add(this.visualPos, v2.mul(forward, -2.45));
        for (const sideOffset of [-1.15, 1.15]) {
            const pos = v2.add(rearCenter, v2.mul(side, sideOffset));
            const velocity = v2.add(
                v2.mul(forward, -util.random(0.35, 0.9)),
                v2.mul(side, util.random(-0.45, 0.45)),
            );
            particleBarn.addParticle(
                "vehicleTireSmoke",
                this.layer,
                pos,
                velocity,
                0.75 + this.driftIntensity * 0.45,
                util.random(0, Math.PI * 2),
                null,
                21,
            );
        }
    }

    private updateSkidMarks(dt: number, camera: Camera, renderer: Renderer, def: NpcDef) {
        for (const segment of this.skidSegments) {
            segment.age += dt;
        }
        this.skidSegments = this.skidSegments.filter(
            (segment) => segment.age < vehicleSkidLifetime,
        );

        const drift = def.vehicle?.drift;
        const drifting =
            !!drift &&
            !this.dead &&
            this.state === "drive" &&
            this.driftIntensity >= drift.smokeThreshold &&
            Math.abs(this.speed) >= drift.minSpeed;

        if (!drifting) {
            this.skidSampleTicker = 0;
            this.skidLastTirePositions = null;
        } else {
            this.skidSampleTicker -= dt;
            if (this.skidSampleTicker <= 0) {
                this.skidSampleTicker = vehicleSkidSampleInterval;
                const forward = v2.create(
                    Math.cos(this.vehicleVisualRot),
                    Math.sin(this.vehicleVisualRot),
                );
                const side = v2.perp(forward);
                const halfWheelBase = def.vehicle!.handling.wheelBase * 0.5;
                const tirePositions: Vec2[] = [];

                for (const forwardOffset of [halfWheelBase, -halfWheelBase]) {
                    const axleCenter = v2.add(
                        this.visualPos,
                        v2.mul(forward, forwardOffset),
                    );
                    for (const sideOffset of [
                        -vehicleTireTrackHalfWidth,
                        vehicleTireTrackHalfWidth,
                    ]) {
                        tirePositions.push(v2.add(axleCenter, v2.mul(side, sideOffset)));
                    }
                }

                if (this.skidLastTirePositions) {
                    for (let i = 0; i < tirePositions.length; i++) {
                        const start = this.skidLastTirePositions[i];
                        const end = tirePositions[i];
                        const distance = v2.length(v2.sub(end, start));
                        if (
                            distance >= 0.01 &&
                            distance <= vehicleSkidMaxSegmentDistance
                        ) {
                            this.skidSegments.push({
                                start: v2.copy(start),
                                end: v2.copy(end),
                                age: 0,
                            });
                        }
                    }
                }
                this.skidLastTirePositions = tirePositions;
            }
        }

        this.skidGraphics.clear();
        this.skidGraphics.visible = this.skidSegments.length > 0;
        if (!this.skidGraphics.visible) return;

        const lineWidth = Math.max(camera.m_scaleToScreen(0.42), 6);
        for (const segment of this.skidSegments) {
            const fadeT = math.clamp((vehicleSkidLifetime - segment.age) / 0.65, 0, 1);
            const start = camera.m_pointToScreen(segment.start);
            const end = camera.m_pointToScreen(segment.end);
            this.skidGraphics.lineStyle({
                width: lineWidth,
                color: 0x151515,
                alpha: 0.48 * fadeT,
                cap: PIXI.LINE_CAP.ROUND,
                join: PIXI.LINE_JOIN.ROUND,
            });
            this.skidGraphics.moveTo(start.x, start.y);
            this.skidGraphics.lineTo(end.x, end.y);
        }
        renderer.addPIXIObj(this.skidGraphics, this.layer, 20, this.__id);
    }
}
