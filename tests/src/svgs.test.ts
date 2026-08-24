import fs from "node:fs";
import npath from "node:path";
import * as svgParser from "svg-parser";
import { expect, test } from "vitest";

const MAX_SIZES: Record<string, number> = {
    map: 800_000,
    loot: 4_000_000,
    particles: 100_000,
    player: 6_000_000,
    guns: 150_000,
    emotes: 50_000,
    proj: 25_000,
    ui: 10_000,
    pass: 10_000,
    gui: 200_000,
    crosshairs: 10_000,
};

const MAX_PATH_LENGTH = 500_000;

const IGNORED_SVGS = ["map-decal-flyer-01.svg"];

function readDirectory(dir: string, filter?: RegExp): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    for (const file of fs.readdirSync(dir)) {
        const filePath = npath.resolve(dir, file);
        const stat = fs.statSync(filePath);

        if (stat?.isDirectory()) {
            results = results.concat(readDirectory(filePath, filter));
        } else if (filter === undefined || filter.test(filePath)) {
            results.push(filePath);
        }
    }

    return results;
}

const imgDir = npath.join(import.meta.dirname, "../../client/public/img/");

const svgPaths = Object.keys(MAX_SIZES)
    .map((path) => {
        return readDirectory(npath.join(imgDir, path), /\.(svg)$/i);
    })
    .flat()
    .filter((p) => {
        return !IGNORED_SVGS.some((i) => p.endsWith(i));
    });

function checkNode(path: string, node: svgParser.ElementNode): void {
    if (!node) return;

    switch (node.tagName) {
        case "svg": {
            if (!node.properties) break;
            const { width, height } = node.properties;
            if (width !== undefined) {
                expect(
                    typeof width === "number" || /^\d+(\.\d+)?px$/.test(String(width)),
                    "SVGs must have pixel width",
                ).toBe(true);
            }
            if (height !== undefined) {
                expect(
                    typeof height === "number" || /^\d+(\.\d+)?px$/.test(String(height)),
                    "SVGs must have pixel height",
                ).toBe(true);
            }
            break;
        }
        case "path": {
            if (!node.properties) break;
            if (typeof node.properties.d !== "string") {
                console.log("why is this <path> tag `d` property not a string???????");
                break;
            }
            const len = node.properties.d.length;

            expect(len, `Path has too many nodes`).toBeLessThanOrEqual(MAX_PATH_LENGTH);
            break;
        }
    }

    for (const child of node.children) {
        if (typeof child === "string") continue;
        if (child.type === "text") continue;
        checkNode(path, child);
    }
}

test.for(svgPaths)("Testing SVG %s", (path) => {
    const stats = fs.statSync(path);

    const baseDir = npath.relative(imgDir, path).split(npath.sep)[0];

    let maxSize = MAX_SIZES[baseDir];

    if (!maxSize) {
        console.warn(`missing max size for directory ${baseDir}`);
        maxSize = 100_000;
    }

    expect(stats.size, `SVG is too big`).toBeLessThan(maxSize);

    const content = fs.readFileSync(path).toString();
    const rootNode = svgParser.parse(content);

    for (const node of rootNode.children) {
        if (typeof node === "string") continue;
        if (node.type === "text") continue;
        checkNode(path, node);
    }
});
