import * as PIXI from "pixi.js-legacy";
import { type NpcDef, NpcDefs } from "../../../shared/defs/npcDefs";
import type { ObjectData, ObjectType } from "../../../shared/net/objectSerializeFns";
import type { Collider } from "../../../shared/utils/coldet";
import { collider } from "../../../shared/utils/collider";
import { math } from "../../../shared/utils/math";
import { util } from "../../../shared/utils/util";
import { v2 } from "../../../shared/utils/v2";
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
    none: {
        sprites: [] as string[],
        loop: false,
        speed: 0,
        play: false,
    },
};

const motherShipTravelSpinSpeed = 0.25;
const motherShipAimTurnSpeed = Math.PI * 2;

export class Npc implements AbstractObject {
    __id!: number;
    __type!: ObjectType.Npc;
    active!: boolean;

    sprite = new PIXI.AnimatedSprite([PIXI.Texture.EMPTY]);
    gunSprite = new PIXI.Sprite();
    targetSprite = new PIXI.Sprite();
    soundLoadingInstance: SoundHandle | null = null;
    soundChargeLoading: SoundHandle | null = null;

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
    rot = 0;
    visualRot = 0;
    scale = 1;
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
    }

    m_free() {
        this.sprite.visible = false;
        this.gunSprite.visible = false;
        this.targetSprite.visible = false;
        this.soundLoadingInstance?.stop();
        this.soundChargeLoading?.stop();
        this.soundLoadingInstance = null;
        this.soundChargeLoading = null;
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

        if (isNew) {
            ctx.resourceManager?.loadAtlas("contact");
            this.targetSprite.texture = PIXI.Texture.from("map-target.img");
        }

        this.posOld = isNew ? v2.copy(data.pos) : v2.copy(this.pos);
        this.pos = v2.copy(data.pos);
        this.rot = data.ori;
        this.scale = data.scale;
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
        }

        const state = def.states.find((candidate) => candidate.name === data.state);
        if (data.state !== this.state) {
            this.setState(def, state?.animation ?? "none");
            this.state = data.state;
        }
    }

    private setState(def: NpcDef, animationName: keyof typeof SpriteAnimDefs) {
        const animation = SpriteAnimDefs[animationName];
        const sprites = this.dead ? [def.img.residue] : animation.sprites;
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

    update(
        dt: number,
        map: Map,
        particleBarn: ParticleBarn,
        audioManager: AudioManager,
        activePlayer: Player,
        renderer: Renderer,
    ) {
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
        const screenPos = camera.m_pointToScreen(this.pos);
        const screenScale = camera.m_pixels(this.scale * this.imgScale);
        this.sprite.position.set(screenPos.x, screenPos.y);
        this.sprite.scale.set(screenScale, screenScale);
        this.sprite.rotation = this.type === "motherShip" ? -this.visualRot : -this.rot;

        if (this.targetActive) {
            const targetScreenPos = camera.m_pointToScreen(this.targetPos);
            const targetScreenScale = camera.m_pixels(0.5);
            this.targetSprite.position.set(targetScreenPos.x, targetScreenPos.y);
            this.targetSprite.scale.set(targetScreenScale, targetScreenScale);
            this.targetSprite.rotation = 0;
        }
    }
}
