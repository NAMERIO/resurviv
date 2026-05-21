import { GameObjectDefs } from "../../../../shared/defs/gameObjectDefs";
import type { ExplosionDef } from "../../../../shared/defs/gameObjects/explosionsDefs";
import { PerkProperties } from "../../../../shared/defs/gameObjects/perkDefs";
import { GameConfig } from "../../../../shared/gameConfig";
import { ObjectType } from "../../../../shared/net/objectSerializeFns";
import { collider } from "../../../../shared/utils/collider";
import { math } from "../../../../shared/utils/math";
import { assert, util } from "../../../../shared/utils/util";
import { type Vec2, v2 } from "../../../../shared/utils/v2";
import type { Game } from "../game";
import { isHideAndSeekHider, isHideAndSeekSeeker } from "../privateLobbyMiniGames";
import type { DamageParams, GameObject } from "./gameObject";
import { EXPLOSION_LOOT_PUSH_FORCE } from "./loot";
import type { Player } from "./player";

interface LineCollision {
    obj: GameObject;
    pos: Vec2;
    distance: number;
    dir: Vec2;
}

export class ExplosionBarn {
    explosions: Explosion[] = [];
    newExplosions: Explosion[] = [];

    constructor(readonly game: Game) {}

    update() {
        for (let i = 0; i < this.explosions.length; i++) {
            this.explode(this.explosions[i]);
        }
        this.explosions.length = 0;
    }

    explode(explosion: Explosion) {
        const def = GameObjectDefs[explosion.type] as ExplosionDef;

        if (def.decalType) {
            this.game.decalBarn.addDecal(
                def.decalType,
                explosion.pos,
                explosion.layer,
                0,
                1,
            );
        }

        if (explosion.type === "explosion_smoke") {
            this.game.smokeBarn.addEmitter(explosion.pos, explosion.layer, false);
            return;
        }

        if (explosion.type === "explosion_antiFire") {
            this.game.smokeBarn.addEmitter(explosion.pos, explosion.layer, true);
            return;
        }

        const coll = collider.createCircle(explosion.pos, explosion.rad);
        const isMineExplosion = explosion.damageParams.gameSourceType === "mine";
        const mineCanAffectLayer = (layer: number) => {
            const explosionOnStairs = !!(explosion.layer & 0x2);
            const targetOnStairs = !!(layer & 0x2);

            if (explosionOnStairs && targetOnStairs) {
                return true;
            }

            return util.toGroundLayer(layer) === util.toGroundLayer(explosion.layer);
        };

        // List of all near objects
        const objects = this.game.grid.intersectCollider(coll);
        const damagedObjects = new Map<number, boolean>();

        for (let angle = -Math.PI; angle < Math.PI; angle += 0.1) {
            // All objects that collided with this line
            const lineCollisions: Array<LineCollision> = [];

            const lineEnd = v2.add(
                explosion.pos,
                v2.rotate(v2.create(explosion.rad, 0), angle),
            );

            for (const obj of objects) {
                const sameExplosionLayer = isMineExplosion
                    ? mineCanAffectLayer(obj.layer)
                    : util.sameLayer(obj.layer, explosion.layer);
                if (!sameExplosionLayer) continue;
                if ((obj as { dead?: boolean }).dead) continue;
                if (obj.__type === ObjectType.Obstacle && obj.height <= 0.25) continue;
                if (
                    obj.__type === ObjectType.Player ||
                    obj.__type === ObjectType.Obstacle ||
                    obj.__type === ObjectType.Loot
                ) {
                    // check if the object hitbox collides with a line from the explosion center to the explosion max distance
                    const intersection = collider.intersectSegment(
                        obj.collider,
                        explosion.pos,
                        lineEnd,
                    );
                    if (intersection) {
                        lineCollisions.push({
                            pos: intersection.point,
                            obj,
                            distance: v2.distance(explosion.pos, intersection.point),
                            dir: v2.neg(v2.normalize(v2.sub(explosion.pos, obj.pos))),
                        });
                    }
                }
            }

            // sort by closest to the explosion center to prevent damaging objects through walls
            lineCollisions.sort((a, b) => a.distance - b.distance);

            for (const collision of lineCollisions) {
                const obj = collision.obj;

                if (!damagedObjects.has(obj.__id)) {
                    damagedObjects.set(obj.__id, true);
                    this.damageObject(explosion, collision);
                }

                if (
                    obj.__type === ObjectType.Obstacle &&
                    obj.collidable &&
                    obj.__id !== explosion.ignoreObstacleId
                )
                    break;
            }
        }

        const bulletDef = GameObjectDefs[def.shrapnelType];
        if (bulletDef && bulletDef.type === "bullet") {
            for (let i = 0, count = def.shrapnelCount ?? 0; i < count; i++) {
                this.game.bulletBarn.fireBullet({
                    bulletType: def.shrapnelType,
                    pos: explosion.pos,
                    layer: explosion.layer,
                    damageType: explosion.damageParams.damageType,
                    playerId: explosion.damageParams.source?.__id ?? 0,
                    sourceTeamId: explosion.damageParams.sourceTeamId,
                    shotFx: false,
                    damageMult: 1,
                    varianceT: Math.random(),
                    gameSourceType: explosion.damageParams.gameSourceType!,
                    mapSourceType: explosion.damageParams.mapSourceType,
                    dir: v2.randomUnit(),
                });
            }
        }
    }

    damageObject(explosion: Explosion, collision: LineCollision) {
        const dist = collision.distance;
        const obj = collision.obj;
        const def = GameObjectDefs[explosion.type] as ExplosionDef;

        if (
            explosion.type === "explosion_flashbang" &&
            obj.__type !== ObjectType.Player
        ) {
            return;
        }

        if (obj.__type === ObjectType.Loot) {
            obj.push(
                v2.normalize(v2.sub(obj.pos, explosion.pos)),
                (def.rad.max - dist) * EXPLOSION_LOOT_PUSH_FORCE,
            );
            return;
        }

        if (obj.__type !== ObjectType.Player && obj.__type !== ObjectType.Obstacle) {
            return;
        }

        let damage = def.damage;

        if (dist > def.rad.min) {
            damage = math.remap(dist, 0, def.rad.max, damage, 0);
        }

        if (obj.__type == ObjectType.Player) {
            if (explosion.type === "explosion_flashbang") {
                const src = explosion.damageParams.source;
                const sourcePlayer =
                    src?.__type === ObjectType.Player ? (src as Player) : undefined;
                const isSourceTeammate =
                    explosion.damageParams.sourceTeamId !== undefined
                        ? explosion.damageParams.sourceTeamId === obj.teamId
                        : sourcePlayer?.teamId === obj.teamId;
                const isSourceArenaTeammate =
                    this.game.arenaPrivate &&
                    sourcePlayer?.arenaTeam !== undefined &&
                    sourcePlayer.arenaTeam === obj.arenaTeam;

                if (!isSourceTeammate && !isSourceArenaTeammate) {
                    obj.applyHideAndSeekBlind(def.blindDuration ?? 4);
                }
                return;
            }

            const isSourceTeammate =
                explosion.damageParams.sourceTeamId !== undefined
                    ? explosion.damageParams.sourceTeamId == obj.teamId
                    : !!(
                          explosion.damageParams.source &&
                          explosion.damageParams.source.__type == ObjectType.Player &&
                          explosion.damageParams.source.teamId == obj.teamId
                      );
            const sourcePlayer =
                explosion.damageParams.source?.__type === ObjectType.Player
                    ? (explosion.damageParams.source as Player)
                    : undefined;
            const isHiderEffectOnSeeker =
                !!sourcePlayer &&
                sourcePlayer !== obj &&
                isHideAndSeekHider(this.game.miniGame, sourcePlayer.arenaTeam) &&
                isHideAndSeekSeeker(this.game.miniGame, obj.arenaTeam);

            if (def.healTeam && isSourceTeammate) {
                const healAmount = def.healAmount ?? 5; // default to 5 if healValue is not defined
                obj.health += healAmount;
                obj.healEffectTicker = 0.5;
                obj.setDirty();
                return;
            }
            if (!isSourceTeammate) {
                if (def.freezeAmount && def.freezeDuration) {
                    const playerRot = Math.atan2(obj.dir.y, obj.dir.x);
                    const collRot = -Math.atan2(collision.dir.y, collision.dir.x);

                    const ori =
                        (math.radToOri(playerRot) + math.radToOri(collRot) + 2) % 4;

                    obj.freeze(ori, def.freezeDuration);
                }
                if (def.dropRandomLoot) {
                    for (let i = 0; i < def.dropRandomLoot; i++) {
                        obj.dropRandomLoot();
                    }
                }

                const src = explosion.damageParams.source;
                if (src && src.__type === ObjectType.Player) {
                    const srcPlayer = src as Player;
                    if (srcPlayer.hasPerk("throw_slow")) {
                        const slowDur =
                            (PerkProperties.throw_slow?.slowDuration as number) ?? 1.0;
                        (obj as Player).shotSlowdownTimer = Math.max(
                            (obj as Player).shotSlowdownTimer,
                            slowDur,
                        );
                    }
                }
            }

            if (explosion.type === "explosion_potato_smgshot") {
                obj.incrementFat();
            }

            if (explosion.type === "explosion_heart_cannonball" && !isSourceTeammate) {
                const src = explosion.damageParams.source;
                if (src && src.__type === ObjectType.Player) {
                    const dir = v2.sub(src.pos, obj.pos);
                    const targetPos = v2.add(obj.pos, v2.mul(dir, 0.6));
                    obj.pullToSourcePos = targetPos;
                    obj.pullToSourceTicker = 1.5;
                    obj.giveHaste(GameConfig.HasteType.HeartPull, 1.5);
                    // obj.shootDisabledTimer = 0.5;
                }
            }

            if (explosion.type === "explosion_snow_cannonball" && !isSourceTeammate) {
                obj.dropRandomLoot();
            }

            if (
                explosion.type === "explosion_fire" &&
                !isSourceTeammate &&
                !isHiderEffectOnSeeker
            ) {
                obj.burnDuration = GameConfig.player.burnDuration;
                obj.burnTicker = GameConfig.player.burnTickRate;
                obj.burnEffect = true;
                obj.setDirty();
            }
        }

        if (obj.__type === ObjectType.Obstacle) {
            damage *= def.obstacleDamage;
        }

        obj.damage({
            ...explosion.damageParams,
            amount: damage,
            dir: collision.dir,
            isExplosion: true,
        });
    }

    flush() {
        this.newExplosions.length = 0;
    }

    addExplosion(
        type: string,
        pos: Vec2,
        layer: number,
        damageParams: Omit<DamageParams, "damage" | "dir">,
        ignoreObstacleId?: number,
    ) {
        const def = GameObjectDefs[type];
        assert(def.type === "explosion", `Invalid explosion with type ${type}`);

        const explosion: Explosion = {
            rad: def.rad.max,
            type,
            pos,
            layer,
            damageParams,
            ignoreObstacleId,
        };
        this.explosions.push(explosion);
        this.newExplosions.push(explosion);
    }
}

interface Explosion {
    rad: number;
    type: string;
    pos: Vec2;
    layer: number;
    damageParams: Omit<DamageParams, "damage" | "dir">;
    ignoreObstacleId?: number;
}
