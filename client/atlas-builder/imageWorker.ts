import fs from "node:fs";
import Path from "node:path";
import { createCanvas, loadImage } from "canvas";
import {
    atlasLogger,
    type ImgCache,
    imageFolder,
    imagesCacheFolder,
} from "./atlasBuilder";
import { scaledSprites } from "./atlasDefs";
import { detectEdges, type Edges } from "./detectEdges";

async function extractEmbeddedPng(svgPath: string): Promise<string | null> {
    try {
        const svg = fs.readFileSync(svgPath, "utf8");

        const match = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
        if (!match) return null;

        const pngBuffer = Buffer.from(match[1], "base64");

        const sizeMatch = svg.match(
            /<svg[^>]*(?:width="(\d+)"[^>]*height="(\d+)")|(?:height="(\d+)"[^>]*width="(\d+)")/,
        );
        const width = parseInt(sizeMatch?.[1] || sizeMatch?.[4] || "0", 10);
        const height = parseInt(sizeMatch?.[2] || sizeMatch?.[3] || "0", 10);

        const outPath = Path.join(
            Path.dirname(svgPath),
            Path.basename(svgPath, ".svg") + ".embedded.png",
        );

        fs.writeFileSync(outPath, pngBuffer);
        if (width > 0 && height > 0) {
            const image = await loadImage(outPath);
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0, 0, width, height);
            fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
        }

        return outPath;
    } catch (err: unknown) {
        atlasLogger.warn(`Failed to extract embedded PNG from ${svgPath}:`, err);
        return null;
    }
}

const tmpCanvas = createCanvas(0, 0);
const tmpCtx = tmpCanvas.getContext("2d");

async function renderImage(path: string, hash: string) {
    const pngFileName = Path.join(imagesCacheFolder, `${hash}.png`);

    const scale = scaledSprites[path] ?? 1;

    let imgPath = Path.join(imageFolder, path);

    if (imgPath.endsWith(".svg")) {
        const extracted = await extractEmbeddedPng(imgPath);
        if (extracted) {
            atlasLogger.info(`Extracted embedded PNG from ${path}`);
            imgPath = extracted;
        }
    }

    const image = await loadImage(imgPath);

    tmpCanvas.width = Math.ceil(image.width * scale);
    tmpCanvas.height = Math.ceil(image.height * scale);

    tmpCtx.drawImage(image, 0, 0, tmpCanvas.width, tmpCanvas.height);

    let edges: Edges;

    try {
        edges = detectEdges(tmpCanvas, {
            tolerance: 0,
        });
    } catch (error) {
        atlasLogger.error(`Failed to detect edges for ${path}`, error);
        edges = {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
        };
    }

    const buff = tmpCanvas.toBuffer("image/png");
    fs.writeFileSync(pngFileName, buff);
    if (imgPath.endsWith(".embedded.png")) {
        fs.unlinkSync(imgPath);
    }

    return edges;
}

export interface ParentMsg {
    images: Array<{ path: string; hash: string }>;
}

process.on("message", async (data: ParentMsg) => {
    const images: ImgCache = {};

    for (const image of data.images) {
        const edges = await renderImage(image.path, image.hash);
        images[image.path] = {
            hash: image.hash,
            edges,
        };
    }

    process.send!(images);
});
