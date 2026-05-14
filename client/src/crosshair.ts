import $ from "jquery";
import { CrosshairDefs } from "../../shared/defs/gameObjects/crosshairDefs";
import type { Crosshair } from "../../shared/utils/loadout";
import { util } from "../../shared/utils/util";

const CrosshairViewBoxSize = 16.933;

function getCrosshairPaddingUnits(crosshairDef: Crosshair) {
    const thickness = Number(crosshairDef.thickness || 0);
    const stroke = Number(crosshairDef.stroke || 0);
    const padding = thickness + stroke;
    return padding > 0 ? padding + 0.5 : 0;
}

export function getCrosshairDims(crosshairDef: Crosshair) {
    const crosshairBase = {
        width: 64,
        height: 64,
    };
    const size = Number(crosshairDef.size);
    const baseWidth = crosshairBase.width * size;
    const baseHeight = crosshairBase.height * size;
    const paddingUnits = getCrosshairPaddingUnits(crosshairDef);
    const paddingPx = (paddingUnits / CrosshairViewBoxSize) * baseWidth * 2;
    return {
        width: Math.round((baseWidth + paddingPx) / 4) * 4,
        height: Math.round((baseHeight + paddingPx) / 4) * 4,
    };
}

function applyCrosshairShape(
    svgCode: string,
    thickness: number,
    stroke: number,
    color: string,
) {
    const svgOpen = svgCode.match(/^<svg[^>]*>/)?.[0];
    if (!svgOpen || !svgCode.endsWith("</svg>")) {
        return svgCode;
    }

    const svgInner = svgCode.slice(svgOpen.length, -"</svg>".length);
    const fillOnlyInner = svgInner
        .replace(/\s+stroke="[^"]*"/g, "")
        .replace(/\s+stroke-width="[^"]*"/g, "");
    const bodyStroke = thickness * 2;
    const outlineStroke = bodyStroke + stroke * 2;
    const strokeAttrs = `stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill"`;
    const outlineLayer =
        stroke > 0
            ? `<g fill="${color}" stroke="black" stroke-width="${outlineStroke}" ${strokeAttrs}>${fillOnlyInner}</g>`
            : "";
    const bodyLayer =
        thickness > 0
            ? `<g fill="${color}" stroke="${color}" stroke-width="${bodyStroke}" ${strokeAttrs}>${fillOnlyInner}</g>`
            : `<g fill="${color}" stroke="none">${fillOnlyInner}</g>`;
    return `${svgOpen}${outlineLayer}${bodyLayer}</svg>`;
}

function getBaseURL(crosshairDef: Crosshair) {
    const objDef = CrosshairDefs[crosshairDef.type];
    if (crosshairDef.type === "crosshair_custom_image") {
        const customImageUrl = getCustomCrosshairImage();
        if (customImageUrl) {
            const _dims = getCrosshairDims(crosshairDef);
            return `url('${customImageUrl}')`;
        }
        return `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 16.933 16.933"><path fill="white" paint-order="fill markers stroke" d="M7.938 4.233h1.058V12.7H7.938z"/><path fill="white" paint-order="fill markers stroke" d="M12.7 7.937v1.058H4.233V7.937z"/></svg>')`;
    }

    const dims = getCrosshairDims(crosshairDef);
    const color = util.rgbToHex(util.intToRgb(crosshairDef.color));
    const strokeWidth = Number(crosshairDef.stroke || 0);
    const thickness = Number(crosshairDef.thickness || 0);
    let svgCode = objDef.code.replace(/white/g, color);
    svgCode = svgCode.replace(/stroke-width=".5"/g, `stroke-width="${strokeWidth}"`);
    svgCode = svgCode.replace(/width="64"/g, `width="${dims.width}"`);
    svgCode = svgCode.replace(/height="64"/g, `height="${dims.height}"`);
    const paddingUnits = getCrosshairPaddingUnits(crosshairDef);
    const paddedViewBoxSize = CrosshairViewBoxSize + paddingUnits * 2;
    svgCode = svgCode.replace(
        /viewBox="0 0 16\.933 16\.933"/g,
        `viewBox="${-paddingUnits} ${-paddingUnits} ${paddedViewBoxSize} ${paddedViewBoxSize}"`,
    );
    svgCode = applyCrosshairShape(svgCode, thickness, strokeWidth, color);
    return `url('data:image/svg+xml;utf8,${(svgCode = svgCode.replace(/#/g, "%23"))}')`;
}

export function getCustomCrosshairImage(): string | null {
    try {
        const stored = localStorage.getItem("customCrosshairImage");
        return stored || null;
    } catch (_e) {
        return null;
    }
}

function resizeImageToStandardSize(
    imageDataUrl: string,
    targetSize: number = 64,
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = targetSize;
            canvas.height = targetSize;
            const ctx = canvas.getContext("2d");

            if (!ctx) {
                reject(new Error("Could not get canvas context"));
                return;
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, targetSize, targetSize);
            try {
                const resizedDataUrl = canvas.toDataURL("image/png");
                resolve(resizedDataUrl);
            } catch (e) {
                console.warn("Failed to convert image to PNG, using original:", e);
                resolve(imageDataUrl);
            }
        };
        img.onerror = (e) => {
            reject(
                new Error(
                    "Failed to load image: " +
                        (e instanceof Error ? e.message : "Unknown error"),
                ),
            );
        };
        img.src = imageDataUrl;
    });
}

export async function setCustomCrosshairImage(imageDataUrl: string): Promise<void> {
    try {
        const resizedImage = await resizeImageToStandardSize(imageDataUrl, 64);
        localStorage.setItem("customCrosshairImage", resizedImage);
    } catch (_e) {
        try {
            localStorage.setItem("customCrosshairImage", imageDataUrl);
        } catch (_e2) {}
    }
}

export function clearCustomCrosshairImage(): void {
    try {
        localStorage.removeItem("customCrosshairImage");
    } catch (_e) {}
}
function getCursorCSS(crosshairDef: Crosshair) {
    const dims = getCrosshairDims(crosshairDef);
    return `${getBaseURL(crosshairDef)} ${dims.width / 2} ${dims.height / 2}, crosshair`;
}

export const crosshair = {
    getCursorURL: function (crosshairDef: Crosshair) {
        if (crosshairDef.type === "crosshair_custom_image") {
            const customImageUrl = getCustomCrosshairImage();
            return customImageUrl || getBaseURL(crosshairDef);
        }
        return getBaseURL(crosshairDef);
    },
    setElemCrosshair: function (elem: JQuery<HTMLElement>, crosshairDef: Crosshair) {
        let cursor = "crosshair";

        if (crosshairDef.type === "crosshair_custom_image") {
            const customImageUrl = getCustomCrosshairImage();
            if (customImageUrl) {
                const dims = getCrosshairDims(crosshairDef);
                cursor = `url("${customImageUrl}") ${dims.width / 2} ${dims.height / 2}, crosshair`;
            } else {
                cursor = "crosshair";
            }
        } else {
            const objDef = CrosshairDefs[crosshairDef.type];
            if (objDef) {
                cursor = objDef.cursor ? objDef.cursor : getCursorCSS(crosshairDef);
            }
        }
        if (elem[0]) {
            (elem[0] as HTMLElement).style.setProperty("cursor", cursor, "important");
        } else {
            elem.css({
                cursor,
            });
        }
    },
    setGameCrosshair: function (crosshairDef: Crosshair) {
        const gameArea = $("#game-area-wrapper");
        if (gameArea.length > 0) {
            crosshair.setElemCrosshair(gameArea, crosshairDef);
        } else {
            setTimeout(() => {
                const retryArea = $("#game-area-wrapper");
                if (retryArea.length > 0) {
                    crosshair.setElemCrosshair(retryArea, crosshairDef);
                }
            }, 100);
        }

        // Adjust UI elements to use the custom crosshair as well
        const objDef = CrosshairDefs[crosshairDef.type];
        const style =
            !objDef || objDef.cursor || crosshairDef.type === "crosshair_custom_image"
                ? "pointer"
                : "inherit";
        $(".ui-zoom, .ui-medical, .ui-settings-button, .ui-weapon-switch").css({
            cursor: style,
        });
    },
};
