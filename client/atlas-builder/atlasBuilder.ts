import cp from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import Path from "node:path";

import { loadImage } from "canvas";
import type { ISpritesheetData } from "pixi.js-legacy";
import type { Atlas } from "../../shared/defs/mapDefs";
import { Logger } from "../../shared/utils/logger";
import { util } from "../../shared/utils/util";
import { Atlases, type AtlasRes, rotatedSprites, scaledSprites } from "./atlasDefs";
import type { MainToWorkerMsg, WorkerToMainMsg } from "./atlasWorker";
import type { Edges } from "./detectEdges";
import type { ParentMsg } from "./imageWorker";

export const cacheFolder = Path.resolve(
    import.meta.dirname,
    "../node_modules/.atlas-cache/",
);

export const atlasLogger = new Logger(
    {
        logDate: false,
        debugLogs: true,
        infoLogs: true,
        warnLogs: true,
        errorLogs: true,
    },
    "Atlas Builder",
);

export const imagesCacheFolder = Path.join(cacheFolder, "img");
export const atlasesCacheFolder = Path.join(cacheFolder, "atlases");

export const imageFolder = Path.resolve(import.meta.dirname, "../public/img");

if (!fs.existsSync(imagesCacheFolder)) {
    fs.mkdirSync(imagesCacheFolder, {
        recursive: true,
    });
}

const imgCacheFilePath = Path.join(cacheFolder, "img-cache.json");

function hashBuff(buff: Buffer) {
    return crypto.createHash("sha256").update(buff).digest("hex");
}

export type ImgCache = Record<
    string,
    {
        hash: string;
        edges: Edges;
    }
>;

export class ImageManager {
    private cache: ImgCache = {};
    private imagesToRender = new Map<string, string>();

    get(key: string): ImgCache[string] | undefined {
        return this.cache[key];
    }

    queueImage(path: string, hash: string) {
        this.imagesToRender.set(path, hash);
    }

    async getCachedImage(filePath: string) {
        const cached = this.cache[filePath];
        if (!cached) {
            throw new Error(`Couldn't find cached image ${filePath}`);
        }
        const fullPath = Path.join(imagesCacheFolder, `${cached.hash}.png`);
        return {
            edges: cached.edges,
            image: await loadImage(fullPath),
        };
    }

    loadFromDisk() {
        if (fs.existsSync(imgCacheFilePath)) {
            this.cache = JSON.parse(fs.readFileSync(imgCacheFilePath).toString("utf8"));
        } else {
            this.cache = {};
        }
    }

    cleanImageCache() {
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

        this.cache = {};
    }

    removeImageFromCache(filePath: string): boolean {
        const cached = this.cache[filePath];
        if (cached) {
            const pngPath = Path.join(imagesCacheFolder, `${cached.hash}.png`);
            if (fs.existsSync(pngPath)) {
                try {
                    fs.unlinkSync(pngPath);
                    delete this.cache[filePath];
                    return true;
                } catch (error) {
                    atlasLogger.warn(`Failed to delete cached image ${pngPath}:`, error);
                }
            }
        }
        delete this.cache[filePath];
        return false;
    }

    writeToDisk() {
        fs.writeFileSync(imgCacheFilePath, JSON.stringify(this.cache));
    }

    async renderImages() {
        if (this.imagesToRender.size === 0) return;

        const imagesToRender = [...this.imagesToRender.entries()].map((a) => {
            return {
                path: a[0],
                hash: a[1],
            };
        });

        const start = Date.now();

        let threadsLeft = Math.max(os.availableParallelism() - 2, 1);

        let imagesPerThread = imagesToRender.length;

        if (imagesToRender.length > 25) {
            imagesPerThread = Math.ceil(imagesToRender.length / threadsLeft);
        }

        let originalCount = imagesToRender.length;

        const promises: Promise<void>[] = [];

        let workers = 0;
        while (imagesToRender.length) {
            threadsLeft--;
            workers++;

            const images = imagesToRender.splice(0, imagesPerThread);
            imagesPerThread = Math.ceil(imagesToRender.length / threadsLeft);

            const proc = cp.fork(Path.resolve(import.meta.dirname, "imageWorker.ts"), {
                execArgv: ["--import", "tsx"],
            });

            const promise = new Promise<void>((resolve) => {
                proc.send({
                    images,
                } satisfies ParentMsg);

                proc.on("message", (msg: ImgCache) => {
                    Object.assign(this.cache, msg);
                    proc.kill();
                    resolve();
                });
            });

            promises.push(promise);
        }

        atlasLogger.info(`Rendering ${originalCount} images`, `with ${workers} workers`);

        await Promise.all(promises);
        this.writeToDisk();

        this.imagesToRender.clear();

        const end = Date.now();
        atlasLogger.info(`Rendered all images after ${end - start}ms`);
    }

    cleanOldFiles() {
        const files = fs.readdirSync(imagesCacheFolder);

        const validCachedImages = new Set<string>(
            Object.values(this.cache).map((i) => i.hash),
        );

        let filesRemoved = 0;
        for (const file of files) {
            const path = Path.join(imagesCacheFolder, file);
            const stat = fs.statSync(path);
            const date = Date.now() - stat.atimeMs;

            // remove files that are over 7 days old and are invalid cache
            if (date > util.daysToMs(7)) {
                const hashKey = file.replace(".png", "");
                const existsInCache = validCachedImages.has(hashKey);

                if (!existsInCache) {
                    filesRemoved++;
                    fs.rmSync(path);
                }
            }
        }
        if (filesRemoved > 0) {
            atlasLogger.info(`Cleaned ${filesRemoved} old images from cache`);
        }
    }
}

// Atlas key -> hash
type AtlasCache = Record<string, string>;
type AtlasData = Record<AtlasRes, ISpritesheetData[]>;

export class AtlasManager {
    atlasCache: AtlasCache = {};

    imageCache = new ImageManager();

    loadFromDisk() {
        this.imageCache.loadFromDisk();
        this.loadAtlasCache();
    }

    writeToDisk() {
        this.imageCache.writeToDisk();
        this.saveAtlasCache();
    }

    loadAtlasCache() {
        const atlasCacheFilePath = Path.join(cacheFolder, "atlas-cache.json");
        if (fs.existsSync(atlasCacheFilePath)) {
            this.atlasCache = JSON.parse(
                fs.readFileSync(atlasCacheFilePath).toString("utf8"),
            );
        } else {
            this.atlasCache = {};
        }
    }

    saveAtlasCache() {
        const atlasCacheFilePath = Path.join(cacheFolder, "atlas-cache.json");
        fs.writeFileSync(atlasCacheFilePath, JSON.stringify(this.atlasCache));
    }

    cleanAtlasCache() {
        if (!fs.existsSync(atlasesCacheFolder)) {
            fs.mkdirSync(atlasesCacheFolder, { recursive: true });
            atlasLogger.info("Created atlas cache folder");
            return;
        }

        const folders = fs.readdirSync(atlasesCacheFolder);
        let deletedCount = 0;

        for (const folder of folders) {
            try {
                const folderPath = Path.join(atlasesCacheFolder, folder);
                fs.rmSync(folderPath, { recursive: true });
                deletedCount++;
            } catch (error) {
                atlasLogger.warn(`Failed to delete cached atlas ${folder}:`, error);
            }
        }

        if (deletedCount > 0) {
            atlasLogger.info(`Cleaned ${deletedCount} cached atlases`);
        }

        this.atlasCache = {};
    }

    cleanOldAtlasFolders(atlasName: Atlas) {
        if (!fs.existsSync(atlasesCacheFolder)) {
            return;
        }

        const folders = fs.readdirSync(atlasesCacheFolder);
        let deletedCount = 0;

        const prefix = `${atlasName}-`;

        for (const folder of folders) {
            if (folder.startsWith(prefix)) {
                const folderPath = Path.join(atlasesCacheFolder, folder);
                try {
                    fs.rmSync(folderPath, { recursive: true });
                    deletedCount++;
                    atlasLogger.info(`Cleaned old atlas folder: ${folder}`);
                } catch (error) {
                    atlasLogger.warn(`Failed to delete atlas folder ${folder}:`, error);
                }
            }
        }

        if (deletedCount > 0) {
            atlasLogger.info(
                `Cleaned ${deletedCount} old folder(s) for atlas: ${atlasName}`,
            );
        }
    }

    cleanChangedAtlasImages(changedAtlases: { name: Atlas; hash: string }[]) {
        const imagesToClean = new Set<string>();

        for (const changedAtlas of changedAtlases) {
            const atlasDef = Atlases[changedAtlas.name];
            for (const file of atlasDef.images) {
                imagesToClean.add(file);
            }
        }

        let deletedCount = 0;
        for (const imageFile of imagesToClean) {
            if (this.imageCache.removeImageFromCache(imageFile)) {
                deletedCount++;
            }
        }

        if (deletedCount > 0) {
            atlasLogger.info(`Cleaned ${deletedCount} cached images for changed atlases`);
        }
    }

    async getAtlas(atlas: Atlas): Promise<AtlasData> {
        const hash = this.atlasCache[atlas];
        const folder = this.getAtlasFolderPath(atlas, hash);

        const path = Path.join(folder, "data.json");
        if (!fs.existsSync(path)) {
            await this.buildAtlases([{ name: atlas, hash }]);
        }

        return JSON.parse(
            fs.readFileSync(Path.join(folder, "data.json")).toString("utf8"),
        );
    }

    hashAtlas(atlas: Atlas): string {
        const atlasDef = Atlases[atlas];

        const images = new Map<string, boolean>();
        for (let i = 0; i < atlasDef.images.length; i++) {
            const image = atlasDef.images[i];
            if (images.has(image)) {
                atlasLogger.warn(`Atlas ${atlas} has duplicated sprite ${image}`);
            }
            images.set(image, true);
        }

        let atlasHash = "";
        for (const file of atlasDef.images) {
            const imagePath = Path.join(imageFolder, file);
            if (!fs.existsSync(imagePath)) {
                atlasLogger.error(`File ${imagePath} doesn't exist`);
                continue;
            }
            const data = fs.readFileSync(imagePath);

            const scale = scaledSprites[file] ?? 1;
            const rotation = rotatedSprites[file] ?? 0;
            const hash = `${hashBuff(data)}-${100 * scale}-${rotation}`;

            if (
                this.imageCache.get(file)?.hash !== hash ||
                !fs.existsSync(Path.join(imagesCacheFolder, `${hash}.png`))
            ) {
                this.imageCache.queueImage(file, hash);
            }

            atlasHash += hash;
        }

        return hashBuff(Buffer.from(atlasHash));
    }

    getAtlasFolderPath(atlas: Atlas, hash: string) {
        return Path.join(atlasesCacheFolder, `${atlas}-${hash}`);
    }

    getChangedAtlases() {
        const changedAtlases: { name: Atlas; hash: string }[] = [];

        for (const atlas of Object.keys(Atlases) as Atlas[]) {
            const hash = this.hashAtlas(atlas);

            const _oldHash = this.atlasCache[atlas];
            const atlasPath = Path.join(
                this.getAtlasFolderPath(atlas, hash),
                "data.json",
            );

            if (!fs.existsSync(atlasPath)) {
                changedAtlases.push({ name: atlas, hash });
                this.cleanOldAtlasFolders(atlas);
            }
            this.atlasCache[atlas] = hash;
        }

        if (changedAtlases.length > 0) {
            atlasLogger.info(
                `Detected ${changedAtlases.length} changed atlas(es), rebuilding...`,
            );
            this.cleanChangedAtlasImages(changedAtlases);
            for (const changedAtlas of changedAtlases) {
                const atlas = changedAtlas.name;
                this.hashAtlas(atlas);
            }
            this.saveAtlasCache();
        } else {
            atlasLogger.info("No atlas changes detected, skipping rebuild");
        }

        return changedAtlases;
    }

    async buildAtlases(atlasesToBuild: { name: Atlas; hash: string }[]) {
        await this.imageCache.renderImages();

        const start = Date.now();

        let threadsLeft = Math.max(os.availableParallelism() - 2, 1);

        let atlasesPerThread = Math.ceil(atlasesToBuild.length / threadsLeft);
        const originalCount = atlasesToBuild.length;

        const promises: Promise<void>[] = [];

        let workers = 0;
        while (atlasesToBuild.length) {
            threadsLeft--;
            workers++;

            const atlases = atlasesToBuild.splice(0, atlasesPerThread);
            atlasesPerThread = Math.ceil(atlasesToBuild.length / threadsLeft);

            const proc = cp.fork(Path.resolve(import.meta.dirname, "atlasWorker.ts"), {
                serialization: "advanced",
                execArgv: ["--import", "tsx"],
            });

            const promise = new Promise<void>((resolve) => {
                proc.send(atlases satisfies MainToWorkerMsg);

                proc.on("message", (msg: WorkerToMainMsg) => {
                    const data = msg;

                    for (const atlas of data) {
                        const atlasPath = this.getAtlasFolderPath(atlas.name, atlas.hash);
                        fs.mkdirSync(atlasPath, {
                            recursive: true,
                        });

                        promises.push(promise);

                        const atlasJson: Record<string, ISpritesheetData[]> = {};

                        for (const sheet of atlas.data) {
                            const filePath = Path.join(atlasPath, sheet.data.meta.image!);
                            fs.writeFileSync(filePath, Buffer.from(sheet.buff));
                            (atlasJson[sheet.res] ??= []).push(sheet.data);
                        }

                        const filePath = Path.join(atlasPath, "data.json");
                        fs.writeFileSync(filePath, JSON.stringify(atlasJson));
                    }

                    proc.kill();
                    resolve();
                });
            });

            promises.push(promise);
        }

        atlasLogger.info(`Rendering ${originalCount} atlases`, `with ${workers} workers`);

        await Promise.all(promises);

        this.saveAtlasCache();

        const end = Date.now();
        atlasLogger.info(`Built all atlases after ${end - start}ms`);
    }

    cleanOldFiles() {
        this.imageCache.cleanOldFiles();

        const files = fs.readdirSync(atlasesCacheFolder);

        const validCachedImages = new Set(
            Object.entries(this.atlasCache).map(([key, value]) => `${key}-${value}`),
        );

        let atlasesRemoved = 0;
        for (const folder of files) {
            const path = Path.join(atlasesCacheFolder, folder);

            const stat = fs.statSync(path);
            const date = Date.now() - stat.atimeMs;

            // remove atlases that are over 7 days old and are invalid cache
            if (date > util.daysToMs(7)) {
                const existsInCache = validCachedImages.has(folder);

                if (!existsInCache) {
                    atlasesRemoved++;
                    fs.rmSync(path, {
                        recursive: true,
                    });
                }
            }
        }
        if (atlasesRemoved > 0) {
            atlasLogger.info(`Cleaned ${atlasesRemoved} old atlases from cache`);
        }
    }
}
