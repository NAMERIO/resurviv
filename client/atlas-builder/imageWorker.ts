import fs from "node:fs";
import Path from "node:path";
import { createCanvas, loadImage } from "canvas";
import sharp from "sharp";
import {
    atlasLogger,
    type ImgCache,
    imageFolder,
    imagesCacheFolder,
} from "./atlasBuilder";
import { scaledSprites } from "./atlasDefs";
import { detectEdges, type Edges } from "./detectEdges";

const tmpCanvas = createCanvas(0, 0);
const tmpCtx = tmpCanvas.getContext("2d");

export function cleanImageCache() {
    if (!fs.existsSync(imagesCacheFolder)) {
        fs.mkdirSync(imagesCacheFolder, { recursive: true });
        atlasLogger.info("Created image cache folder");
        return;
    }

    const files = fs.readdirSync(imagesCacheFolder);
    let deletedCount = 0;

    for (const file of files) {
        if (file.endsWith(".png")) {
            try {
                fs.unlinkSync(Path.join(imagesCacheFolder, file));
                deletedCount++;
            } catch (error) {
                atlasLogger.warn(`Failed to delete cached file ${file}:`, error);
            }
        }
    }

    if (deletedCount > 0) {
        atlasLogger.info(`Cleaned ${deletedCount} cached images`);
    }
}

async function renderImage(path: string, hash: string) {
    const pngFileName = Path.join(imagesCacheFolder, `${hash}.png`);
    const fullPath = Path.join(imageFolder, path);
    const scale = scaledSprites[path] ?? 1;
    const isSvg = path.toLowerCase().endsWith(".svg");

    let edges: Edges;

    try {
        if (isSvg) {
            const svgBuffer = fs.readFileSync(fullPath);
            const metadata = await sharp(svgBuffer).metadata();
            const width = Math.ceil((metadata.width || 256) * scale);
            const height = Math.ceil((metadata.height || 256) * scale);
            const pngBuffer = await sharp(svgBuffer)
                .resize(width, height, {
                    fit: "contain",
                    background: { r: 0, g: 0, b: 0, alpha: 0 },
                })
                .png({
                    quality: 100,
                    compressionLevel: 9,
                    adaptiveFiltering: true,
                })
                .toBuffer();

            fs.writeFileSync(pngFileName, pngBuffer);
            const image = await loadImage(pngFileName);
            tmpCanvas.width = image.width;
            tmpCanvas.height = image.height;
            tmpCtx.drawImage(image, 0, 0);
        } else {
            const image = await loadImage(fullPath);
            tmpCanvas.width = Math.ceil(image.width * scale);
            tmpCanvas.height = Math.ceil(image.height * scale);
            tmpCtx.drawImage(image, 0, 0, tmpCanvas.width, tmpCanvas.height);

            const buff = tmpCanvas.toBuffer("image/png");
            fs.writeFileSync(pngFileName, buff);
        }
        edges = detectEdges(tmpCanvas, {
            tolerance: 0,
        });
    } catch (error) {
        atlasLogger.error(`Failed to process image ${path}`, error);
        edges = {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
        };
    }

    return edges;
}

export interface ParentMsg {
    images: Array<{ path: string; hash: string }>;
    cleanCache?: boolean;
}

process.on("message", async (data: ParentMsg) => {
    if (data.cleanCache) {
        cleanImageCache();
    }
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
