import { type CanvasRenderingContext2D, createCanvas } from "canvas";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { type MapDef, MapDefs } from "../../../shared/defs/mapDefs";
import { MapObjectDefs } from "../../../shared/defs/mapObjectDefs";
import type { BuildingDef, ObstacleDef } from "../../../shared/defs/mapObjectsTyping";
import { GameConfig } from "../../../shared/gameConfig";
import type { GroundPatch, MapMsg } from "../../../shared/net/mapMsg";
import type { Circle } from "../../../shared/utils/coldet";
import { collider } from "../../../shared/utils/collider";
import { mapHelpers } from "../../../shared/utils/mapHelpers";
import { math } from "../../../shared/utils/math";
import {
    generateJaggedAabbPoints,
    generateTerrain,
} from "../../../shared/utils/terrainGen";
import { util } from "../../../shared/utils/util";
import { v2, type Vec2 } from "../../../shared/utils/v2";

function drawLine(canvas: CanvasRenderingContext2D, pt0: Vec2, pt1: Vec2) {
    canvas.moveTo(pt0.x, pt0.y);
    canvas.lineTo(pt1.x, pt1.y);
}
function tracePath(canvas: CanvasRenderingContext2D, path: Vec2[]) {
    let point = path[0];
    canvas.moveTo(point.x, point.y);
    for (let i = 1; i < path.length; ++i) {
        point = path[i];
        canvas.lineTo(point.x, point.y);
    }
    canvas.closePath();
}
function traceGroundPatch(
    canvas: CanvasRenderingContext2D,
    patch: GroundPatch,
    seed: number,
) {
    const width = patch.max.x - patch.min.x;
    const height = patch.max.y - patch.min.y;

    const offset = math.max(patch.offsetDist, 0.001);
    const roughness = patch.roughness;

    const divisionsX = Math.round((width * roughness) / offset);
    const divisionsY = Math.round((height * roughness) / offset);

    const seededRand = util.seededRand(seed);
    tracePath(
        canvas,
        generateJaggedAabbPoints(
            patch as any,
            divisionsX,
            divisionsY,
            offset,
            seededRand,
        ),
    );
}

function getMinimapRender(obj: MapMsg["objects"][number]) {
    const def = MapObjectDefs[obj.type] as ObstacleDef | BuildingDef;
    const zIdx =
        def.type == "building" ? 750 + (def.zIdx || 0) : def.img.zIdx || 0;
    let shapes: Array<{
        scale?: number;
        color: number;
        collider: Circle;
    }> = [];
    if ((def as BuildingDef).map?.shapes !== undefined) {
        // @ts-expect-error stfu
        shapes = (def as BuildingDef).map?.shapes!;
    } else {
        let col = null;
        if (
            (col =
                def.type == "obstacle"
                    ? def.collision
                    : def.ceiling.zoomRegions.length > 0 &&
                        def.ceiling.zoomRegions[0].zoomIn
                        ? def.ceiling.zoomRegions[0].zoomIn
                        : mapHelpers.getBoundingCollider(obj.type))
        ) {
            shapes.push({
                collider: collider.copy(col) as Circle,
                scale: def.map?.scale! || 1,
                color: def.map?.color!,
            });
        }
    }
    return {
        obj,
        zIdx,
        shapes,
    };
}

export function renderMap(mapMsg: MapMsg) {
    const terrain = generateTerrain(
        mapMsg.width,
        mapMsg.height,
        mapMsg.shoreInset,
        mapMsg.grassInset,
        mapMsg.rivers,
        mapMsg.seed,
    );

    const canvas = createCanvas(mapMsg.width, mapMsg.height);

    const groundGfx = canvas.getContext("2d");

    const width = mapMsg.width;
    const height = mapMsg.height;
    const mapRender = true;
    const gridThickness = 1;

    const ll = {
        x: 0,
        y: 0,
    };
    const lr = {
        x: width,
        y: 0,
    };
    const ul = {
        x: 0,
        y: height,
    };
    const ur = {
        x: width,
        y: height,
    };
    const mapDef = MapDefs[mapMsg.mapName as keyof typeof MapDefs] as MapDef;
    const mapColors = mapDef.biome.colors;
    const groundPatches = mapMsg.groundPatches;

    groundGfx.save();
    groundGfx.scale(1, -1);
    groundGfx.translate(0, -height);

    // Water
    groundGfx.moveTo(ul.x, ul.y);
    groundGfx.lineTo(ur.x, ur.y);
    groundGfx.lineTo(lr.x, lr.y);
    groundGfx.lineTo(ll.x, ll.y);
    groundGfx.fillStyle = util.intToHex(mapColors.water);
    groundGfx.fill();

    groundGfx.beginPath();
    tracePath(groundGfx, terrain?.shore);
    groundGfx.fillStyle = util.intToHex(mapColors.beach);
    groundGfx.fill();

    groundGfx.beginPath();
    tracePath(groundGfx, terrain?.grass);
    groundGfx.fillStyle = util.intToHex(mapColors.grass);
    groundGfx.fill();

    // Order 0 ground patches
    for (let i = 0; i < groundPatches.length; i++) {
        const patch = groundPatches[i];
        if (patch.order == 0 && (!mapRender || !!patch.useAsMapShape)) {
            groundGfx.beginPath();
            traceGroundPatch(groundGfx, patch, mapMsg.seed);
            groundGfx.fillStyle = util.intToHex(patch.color);
            groundGfx.fill();
        }
    }

    // River shore
    groundGfx.beginPath();
    for (let i = 0; i < terrain.rivers.length; i++) {
        tracePath(groundGfx, terrain.rivers[i].shorePoly);
    }
    groundGfx.fillStyle = util.intToHex(mapColors.riverbank);
    groundGfx.fill();

    groundGfx.beginPath();
    for (let b = 0; b < terrain.rivers.length; b++) {
        tracePath(groundGfx, terrain.rivers[b].waterPoly);
    }
    groundGfx.fillStyle = util.intToHex(mapColors.water);
    groundGfx.fill();

    // Grid
    groundGfx.lineWidth = gridThickness;
    groundGfx.strokeStyle = "rgba(0, 0, 0, 0.15)";
    for (let x = 0; x <= width; x += GameConfig.map.gridSize) {
        drawLine(
            groundGfx,
            {
                x,
                y: 0,
            },
            {
                x,
                y: height,
            },
        );
    }
    for (let y = 0; y <= height; y += GameConfig.map.gridSize) {
        drawLine(
            groundGfx,
            {
                x: 0,
                y,
            },
            {
                x: width,
                y,
            },
        );
    }
    groundGfx.stroke();

    // Order 1 ground patches
    for (let i = 0; i < groundPatches.length; i++) {
        const patch = groundPatches[i];
        if (patch.order == 1 && (!mapRender || !!patch.useAsMapShape)) {
            groundGfx.beginPath();
            traceGroundPatch(groundGfx, patch, mapMsg.seed);
            groundGfx.fillStyle = util.intToHex(patch.color);
            groundGfx.fill();
        }
    }

    // map objects
    const objects = mapMsg.objects.filter((obj) => {
        const def = MapObjectDefs[obj.type];
        if (def.type == "structure") return false;
        return true;
    });
    const minimapRenders = [];
    for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        minimapRenders.push(getMinimapRender(obj));
    }
    minimapRenders.sort((a, b) => {
        return a.zIdx - b.zIdx;
    });

    for (let i = 0; i < minimapRenders.length; i++) {
        const render = minimapRenders[i];
        const obj = render.obj;
        for (let j = 0; j < render.shapes.length; j++) {
            const shape = render.shapes[j];
            const col = collider.transform(
                shape.collider,
                obj.pos,
                math.oriToRad(obj.ori),
                obj.scale,
            );
            const scale = shape.scale !== undefined ? shape.scale : 1;

            groundGfx.fillStyle = util.intToHex(shape.color);
            groundGfx.beginPath();
            switch (col.type) {
                case collider.Type.Circle:
                    groundGfx.arc(
                        col.pos.x,
                        col.pos.y,
                        col.rad * scale,
                        0,
                        Math.PI * 2,
                    );
                    break;
                case collider.Type.Aabb: {
                    let A = v2.mul(v2.sub(col.max, col.min), 0.5);
                    const O = v2.add(col.min, A);
                    A = v2.mul(A, scale);
                    groundGfx.rect(O.x - A.x, O.y - A.y, A.x * 2, A.y * 2);
                }
            }
            groundGfx.closePath();
            groundGfx.fill();
        }
    }

    groundGfx.restore();
    for (let i = 0; i < mapMsg.places.length; i++) {
        const place = mapMsg.places[i];
        groundGfx.fillStyle = "white";
        groundGfx.fillText(place.name, place.pos.x * mapMsg.width, place.pos.y * mapMsg.height)
    }
    groundGfx.save();
    groundGfx.scale(1, -1);
    groundGfx.translate(0, -height);
    for (let i = 0; i < mapMsg.rivers.length; i++) {
        const river = mapMsg.rivers[i];
        const path = river.points;
        groundGfx.strokeStyle = "black";
        groundGfx.lineWidth = 2;
        let point = path[0];

        groundGfx.beginPath();
        groundGfx.moveTo(point.x, point.y);
        for (let i = 1; i < path.length; ++i) {
            point = path[i];
            groundGfx.lineTo(point.x, point.y);
        }
        groundGfx.stroke();
        groundGfx.closePath();

        for (let i = 0; i < path.length; i++) {
            const point = path[i];
            groundGfx.fillStyle = "red";
            groundGfx.globalAlpha = 0.3;
            groundGfx.beginPath();
            groundGfx.arc(point.x, point.y, 5, 0, Math.PI * 2);
            groundGfx.fill();
            groundGfx.globalAlpha = 1;
        }

        groundGfx.fillText(river.points.length.toString(), 5, i * 10 + 10)
    }
    groundGfx.restore();

    for (let i = 0; i < mapMsg.rivers.length; i++) {
        const river = mapMsg.rivers[i];
        groundGfx.strokeStyle = "white";
        groundGfx.font = "18px serif"
        groundGfx.strokeText(river.points.length.toString(), 5, i * 20 + 20);
        groundGfx.fillText(river.points.length.toString(), 5, i * 20 + 20);
    }

    const webhookUrl = "https://discord.com/api/webhooks/1447239903481036925/CER_AMhfodgDEW6oZwfH_o6wU4_5Ih831wMvo6vZv8NMZpWXSP28Z4klOV5WF0GiCS9H";


    const buffer = canvas.toBuffer("image/png");

    const formData = new FormData();

    // @ts-expect-error shut the fuck up
    const blob = new Blob([buffer], { type: 'image/png' });
    formData.append('file', blob, `${mapMsg.mapName}-${mapMsg.seed}.png`);

    // Optional message
    formData.append('payload_json', JSON.stringify({
        content: `Map: ${mapMsg.mapName} | Seed: ${mapMsg.seed}`
    }));

    fetch(webhookUrl, {
        method: 'POST',
        body: formData
    });
}