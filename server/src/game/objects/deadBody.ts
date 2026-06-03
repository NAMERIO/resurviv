import { ObjectType } from "../../../../shared/net/objectSerializeFns";
import { collider } from "../../../../shared/utils/collider";
import { util } from "../../../../shared/utils/util";
import { type Vec2, v2 } from "../../../../shared/utils/v2";
import type { Game } from "../game";
import { BaseGameObject } from "./gameObject";

export const amongUsDeadBodyReportRad = 3.25;

export class DeadBodyBarn {
    deadBodies: DeadBody[] = [];

    constructor(readonly game: Game) {}

    update(dt: number) {
        for (let i = 0; i < this.deadBodies.length; i++) {
            const deadBody = this.deadBodies[i];
            deadBody.update(dt);
        }
    }

    addDeadBody(pos: Vec2, playerId: number, layer: number, dir: Vec2) {
        const deadBody = new DeadBody(this.game, pos, playerId, layer, dir);
        this.deadBodies.push(deadBody);
        this.game.objectRegister.register(deadBody);
    }

    getReportableDeadBody(pos: Vec2, rad: number, layer: number) {
        const objs = this.game.grid.intersectCollider(
            collider.createCircle(pos, rad + amongUsDeadBodyReportRad),
        );

        let closestBody: DeadBody | undefined;
        let closestDistSq = Number.MAX_VALUE;

        for (const obj of objs) {
            if (obj.__type !== ObjectType.DeadBody || obj.destroyed) continue;
            if (!util.sameLayer(obj.layer, layer)) continue;

            const distSq = v2.lengthSqr(v2.sub(pos, obj.pos));
            const reportRad = rad + amongUsDeadBodyReportRad;
            if (distSq <= reportRad * reportRad && distSq < closestDistSq) {
                closestBody = obj;
                closestDistSq = distSq;
            }
        }

        return closestBody;
    }

    clear() {
        for (const deadBody of [...this.deadBodies]) {
            deadBody.destroy();
        }
        this.deadBodies.length = 0;
    }
}

export class DeadBody extends BaseGameObject {
    bounds = collider.createAabbExtents(v2.create(0, 0), v2.create(2, 2));

    override readonly __type = ObjectType.DeadBody;

    layer: number;
    playerId: number;

    vel: Vec2;
    oldPos: Vec2;

    constructor(game: Game, pos: Vec2, playerId: number, layer: number, dir: Vec2) {
        super(game, pos);
        this.layer = layer;
        this.playerId = playerId;
        this.vel = v2.mul(dir, 10);
        this.oldPos = v2.copy(this.pos);
    }

    update(dt: number): void {
        const moving =
            Math.abs(this.vel.x) > 0.001 ||
            Math.abs(this.vel.y) > 0.001 ||
            !v2.eq(this.oldPos, this.pos);

        if (!moving) return;

        this.oldPos = v2.copy(this.pos);

        this.vel = v2.mul(this.vel, 0.95);

        v2.set(this.pos, v2.add(this.pos, v2.mul(this.vel, dt)));
        this.vel = v2.mul(this.vel, 1 / (1 + dt * 3));

        this.game.map.clampToMapBounds(this.pos);

        const originalLayer = this.layer;
        const objs = this.game.grid.intersectGameObject(this);
        this.checkStairs(objs, 2);

        this.game.map.clampToMapBounds(this.pos);

        if (this.layer !== originalLayer) {
            this.setDirty();
        }

        if (!v2.eq(this.oldPos, this.pos)) {
            this.setPartDirty();
            this.game.grid.updateObject(this);
        }
    }

    override destroy() {
        util.removeFrom(this.game.deadBodyBarn.deadBodies, this);
        super.destroy();
    }
}
