import { type AABB, type Collider, coldet } from "./coldet";
import { math } from "./math";
import { type Vec2, v2 } from "./v2";

//
// collider
//

export const collider = {
    Type: {
        Circle: 0 as const,
        Aabb: 1 as const,
        Polygon: 2 as const,
    },

    createCircle(pos: Vec2, rad: number) {
        return {
            type: collider.Type.Circle,
            pos: v2.copy(pos),
            rad,
        };
    },

    createAabb(min: Vec2, max: Vec2) {
        // console.log(min, max)
        return {
            type: collider.Type.Aabb,
            min: v2.copy(min),
            max: v2.copy(max),
        };
    },

    createAabbExtents(pos: Vec2, extent: Vec2) {
        const min = v2.sub(pos, extent);
        const max = v2.add(pos, extent);
        return collider.createAabb(min, max);
    },

    createPolygon(points: Vec2[]) {
        return {
            type: collider.Type.Polygon,
            points: points.map(v2.copy),
        };
    },

    createBounding(colliders: Collider[]) {
        if (colliders.length === 1) {
            return collider.copy(colliders[0]);
        }
        const aabbs: AABB[] = [];
        for (let i = 0; i < colliders.length; i++) {
            const col = colliders[i];
            aabbs.push(collider.toAabb(col));
        }
        const bound = coldet.boundingAabb(aabbs);
        return collider.createAabb(bound.min, bound.max);
    },

    toAabb(c: Collider) {
        if (c.type === collider.Type.Aabb) {
            return collider.createAabb(c.min, c.max);
        }
        if (c.type === collider.Type.Polygon) {
            const min = v2.create(Infinity, Infinity);
            const max = v2.create(-Infinity, -Infinity);
            for (const point of c.points) {
                min.x = math.min(min.x, point.x);
                min.y = math.min(min.y, point.y);
                max.x = math.max(max.x, point.x);
                max.y = math.max(max.y, point.y);
            }
            return collider.createAabb(min, max);
        }
        const aabb = coldet.circleToAabb(c.pos, c.rad);
        return collider.createAabb(aabb.min, aabb.max);
    },

    copy(c: Collider) {
        if (c.type === collider.Type.Circle) {
            return collider.createCircle(c.pos, c.rad);
        }
        if (c.type === collider.Type.Polygon) {
            return collider.createPolygon(c.points);
        }
        return collider.createAabb(c.min, c.max);
    },

    transform(col: Collider, pos: Vec2, rot: number, scale: number) {
        if (col.type === collider.Type.Polygon) {
            return collider.createPolygon(
                col.points.map((point) =>
                    v2.add(v2.rotate(v2.mul(point, scale), rot), pos),
                ),
            );
        }
        if (col.type === collider.Type.Aabb) {
            const e = v2.mul(v2.sub(col.max, col.min), 0.5);
            const c = v2.add(col.min, e);
            const pts = [
                v2.create(c.x - e.x, c.y - e.y),
                v2.create(c.x - e.x, c.y + e.y),
                v2.create(c.x + e.x, c.y - e.y),
                v2.create(c.x + e.x, c.y + e.y),
            ];
            const min = v2.create(Number.MAX_VALUE, Number.MAX_VALUE);
            const max = v2.create(-Number.MAX_VALUE, -Number.MAX_VALUE);
            for (let i = 0; i < pts.length; i++) {
                const p = v2.add(v2.rotate(v2.mul(pts[i], scale), rot), pos);
                min.x = math.min(min.x, p.x);
                min.y = math.min(min.y, p.y);
                max.x = math.max(max.x, p.x);
                max.y = math.max(max.y, p.y);
            }

            return collider.createAabb(min, max);
        }
        return collider.createCircle(
            v2.add(v2.rotate(v2.mul(col.pos, scale), rot), pos),
            col.rad * scale,
        );
    },

    getPoints(aabb: AABB) {
        const pts: Vec2[] = [];
        const { min } = aabb;
        const { max } = aabb;
        pts[0] = v2.create(min.x, min.y);
        pts[1] = v2.create(min.x, max.y);
        pts[2] = v2.create(max.x, min.y);
        pts[3] = v2.create(max.x, max.y);

        return pts;
    },

    intersectCircle(col: Collider, pos: Vec2, rad: number) {
        if (col.type === collider.Type.Polygon) {
            return coldet.intersectPolygonCircle(col.points, pos, rad);
        }
        if (col.type === collider.Type.Aabb) {
            return coldet.intersectAabbCircle(col.min, col.max, pos, rad);
        }
        return coldet.intersectCircleCircle(col.pos, col.rad, pos, rad);
    },

    intersectAabb(col: Collider, min: Vec2, max: Vec2) {
        if (col.type === collider.Type.Polygon) {
            return coldet.intersectPolygonPolygon(
                col.points,
                coldet.aabbPoints(min, max),
            );
        }
        if (col.type === collider.Type.Aabb) {
            return coldet.intersectAabbAabb(col.min, col.max, min, max);
        }
        return coldet.intersectAabbCircle(min, max, col.pos, col.rad);
    },

    intersectSegment(col: Collider, a: Vec2, b: Vec2) {
        if (col.type === collider.Type.Polygon) {
            return coldet.intersectSegmentPolygon(a, b, col.points);
        }
        if (col.type === collider.Type.Aabb) {
            return coldet.intersectSegmentAabb(a, b, col.min, col.max);
        }
        return coldet.intersectSegmentCircle(a, b, col.pos, col.rad);
    },

    intersect(colA: Collider, colB: Collider) {
        if (colA.type === collider.Type.Polygon) {
            if (colB.type === collider.Type.Polygon) {
                return coldet.intersectPolygonPolygon(colA.points, colB.points);
            }
            if (colB.type === collider.Type.Aabb) {
                return coldet.intersectPolygonPolygon(
                    colA.points,
                    coldet.aabbPoints(colB.min, colB.max),
                );
            }
            return coldet.intersectPolygonCircle(colA.points, colB.pos, colB.rad);
        }
        if (colB.type === collider.Type.Polygon) {
            if (colA.type === collider.Type.Aabb) {
                return coldet.intersectPolygonPolygon(
                    coldet.aabbPoints(colA.min, colA.max),
                    colB.points,
                );
            }
            const result = coldet.intersectPolygonCircle(colB.points, colA.pos, colA.rad);
            return result
                ? {
                      dir: v2.mul(result.dir, -1),
                      pen: result.pen,
                  }
                : null;
        }
        if (colB.type === collider.Type.Aabb) {
            return collider.intersectAabb(colA, colB.min, colB.max);
        }
        return collider.intersectCircle(colA, colB.pos, colB.rad);
    },
};
