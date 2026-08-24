import $ from "jquery";
import { GameObjectDefs } from "../../shared/defs/gameObjectDefs";
import type { GunSkinDef } from "../../shared/defs/gameObjects/gunSkinDefs";
import type { MeleeDef } from "../../shared/defs/gameObjects/meleeDefs";
import {
    getOutfitLootImg,
    type OutfitDef,
    OutfitDefs,
} from "../../shared/defs/gameObjects/outfitDefs";
import { MapDefs } from "../../shared/defs/mapDefs";
import { Rarity } from "../../shared/gameConfig";
import * as net from "../../shared/net/net";
import { device } from "./device";

const truncateCanvas = document.createElement("canvas");
const outfitSkinLootImageCache = new Map<string, string>();
const outfitSkinLootImagePromises = new Map<string, Promise<string>>();

function getPlayerSpritePath(sprite: string) {
    const path = `img/player/${sprite.slice(0, -4)}.svg`;
    return GIT_VERSION ? `${path}?v=${encodeURIComponent(GIT_VERSION)}` : path;
}

interface OutfitSkinImageLayer {
    sprite: string;
    tint: number;
    scale: number;
    x: number;
    y: number;
}

function getSvgDimensions(svg: string) {
    const document = new DOMParser().parseFromString(svg, "image/svg+xml");
    const root = document.documentElement;
    const viewBox = root
        .getAttribute("viewBox")
        ?.trim()
        .split(/[\s,]+/)
        .map(Number);
    const parseDimension = (value: string | null) =>
        value ? Number.parseFloat(value) : undefined;

    return {
        width:
            parseDimension(root.getAttribute("width")) ??
            (viewBox?.length === 4 ? viewBox[2] : 140),
        height:
            parseDimension(root.getAttribute("height")) ??
            (viewBox?.length === 4 ? viewBox[3] : 140),
    };
}

function getOutfitSkinLayers(def: OutfitDef): OutfitSkinImageLayer[] {
    const img = def.skinImg;
    const accessory = img.frontSprite
        ? [
              {
                  sprite: img.frontSprite,
                  tint: 0xffffff,
                  scale: 0.27,
                  x: img.frontSpritePos?.x ?? 0,
                  y: img.frontSpritePos?.y ?? 0,
              },
          ]
        : [];
    const hands = [
        {
            sprite: img.handSprite,
            tint: img.handTint,
            scale: 0.175,
            x: 14,
            y: -12.25,
        },
        {
            sprite: img.handSprite,
            tint: img.handTint,
            scale: 0.175,
            x: 14,
            y: 12.25,
        },
    ];

    return [
        {
            sprite: img.backpackSprite,
            tint: img.backpackTint,
            scale: 0.215,
            x: -10.25,
            y: 0,
        },
        {
            sprite: img.baseSprite,
            tint: img.baseTint,
            scale: 0.25,
            x: 0,
            y: 0,
        },
        ...(img.aboveHand ? hands : accessory),
        ...(img.aboveHand ? accessory : hands),
    ];
}

export function createOutfitSkinPreview(
    def: OutfitDef,
    previewScale = 1.1,
    className = "",
) {
    const preview = $("<div/>", {
        class: className,
        "aria-hidden": "true",
        css: {
            height: "100%",
            overflow: "hidden",
            position: "relative",
            transform: "translateY(3px) rotate(90deg)",
            width: "100%",
        },
    });

    for (const [zIndex, layerDef] of getOutfitSkinLayers(def).entries()) {
        const imagePath = getPlayerSpritePath(layerDef.sprite);
        const layer = $("<span/>", {
            css: {
                display: "block",
                left: `calc(50% + ${layerDef.x * previewScale}px)`,
                lineHeight: 0,
                position: "absolute",
                top: `calc(50% + ${layerDef.y * previewScale}px)`,
                transform: `translate(-50%, -50%) scale(${
                    layerDef.scale * previewScale
                })`,
                transformOrigin: "center",
                zIndex,
            },
        });
        layer.append(
            $("<img/>", {
                alt: "",
                draggable: false,
                src: imagePath,
                css: {
                    display: "block",
                    height: "auto",
                    maxWidth: "none",
                    width: "auto",
                },
            }),
        );

        if (layerDef.tint !== 0xffffff) {
            const tintColor = `#${layerDef.tint.toString(16).padStart(6, "0")}`;
            layer.append(
                $("<span/>", {
                    css: {
                        backgroundColor: tintColor,
                        inset: 0,
                        mask: `url("${imagePath}") center / 100% 100% no-repeat`,
                        mixBlendMode: "multiply",
                        position: "absolute",
                    },
                }),
            );
        }

        preview.append(layer);
    }

    return preview;
}

export function createLootPreview(
    gameType: string,
    className = "",
    options: {
        outfitScale?: number;
        gunSkinScale?: number;
    } = {},
) {
    const def = GameObjectDefs[gameType];
    if (def?.type === "outfit" && (def as OutfitDef).lootImg.skinLootImg) {
        return createOutfitSkinPreview(def as OutfitDef, options.outfitScale, className);
    }

    const isGunSkin = def?.type === "gun_skin";
    const transform =
        isGunSkin && options.gunSkinScale !== undefined
            ? `rotate(45deg) scale(${options.gunSkinScale})`
            : helpers.getCssTransformFromGameType(gameType);
    return $("<div/>", {
        class: `${className}${isGunSkin ? " loot-preview-gun-skin" : ""}`,
        css: {
            "background-image": `url(${helpers.getSvgFromGameType(gameType)})`,
            "background-position": "center",
            "background-repeat": "no-repeat",
            ...(isGunSkin ? { "background-size": "contain" } : {}),
            height: "100%",
            transform,
            width: "100%",
        },
    });
}

async function buildOutfitSkinLootImage(def: OutfitDef) {
    const layers = getOutfitSkinLayers(def);
    const sources = await Promise.all(
        layers.map(async (layer) => {
            const path = getPlayerSpritePath(layer.sprite);
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed loading skin sprite ${path}`);
            }
            return response.text();
        }),
    );

    const filters: string[] = [];
    const images = layers.map((layer, index) => {
        const source = sources[index];
        const { width, height } = getSvgDimensions(source);
        const filterId = `skin-loot-tint-${index}`;
        if (layer.tint !== 0xffffff) {
            const tint = `#${layer.tint.toString(16).padStart(6, "0")}`;
            filters.push(
                `<filter id="${filterId}" color-interpolation-filters="sRGB"><feFlood flood-color="${tint}" result="tint"/><feBlend in="SourceGraphic" in2="tint" mode="multiply" result="tinted"/><feComposite in="tinted" in2="SourceAlpha" operator="in"/></filter>`,
            );
        }

        const scaledWidth = width * layer.scale;
        const scaledHeight = height * layer.scale;
        const sourceUrl = `data:image/svg+xml,${encodeURIComponent(source)}`;
        const filter = layer.tint === 0xffffff ? "" : ` filter="url(#${filterId})"`;
        return `<image href="${sourceUrl}" x="${layer.x - scaledWidth / 2}" y="${layer.y - scaledHeight / 2}" width="${scaledWidth}" height="${scaledHeight}"${filter}/>`;
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="-44 -44 88 88"><defs>${filters.join("")}</defs><g transform="translate(0 3) rotate(90)">${images.join("")}</g></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function queueOutfitSkinLootImage(type: string, def: OutfitDef) {
    const existing = outfitSkinLootImagePromises.get(type);
    if (existing) return existing;

    const promise = buildOutfitSkinLootImage(def)
        .then((image) => {
            outfitSkinLootImageCache.set(type, image);
            return image;
        })
        .catch((error) => {
            console.error(`Failed generating skin loot image for ${type}`, error);
            return "";
        });
    outfitSkinLootImagePromises.set(type, promise);
    return promise;
}

if (typeof window !== "undefined") {
    for (const [type, def] of Object.entries(OutfitDefs)) {
        if (def.lootImg.skinLootImg) {
            queueOutfitSkinLootImage(type, def);
        }
    }
}

const rarityVisuals: Record<
    Rarity,
    {
        text: string;
        border: string;
        backgroundColor: string;
    }
> = {
    [Rarity.Stock]: {
        text: "#c5c5c5",
        border: "#969696",
        backgroundColor: "#282828",
    },
    [Rarity.Common]: {
        text: "#c5c5c5",
        border: "#A1A1A1",
        backgroundColor: "#3E3E3E",
    },
    [Rarity.Uncommon]: {
        text: "#1dff55",
        border: "#80B251",
        backgroundColor: "#465C33",
    },
    [Rarity.Rare]: {
        text: "#00deff",
        border: "#50AFAB",
        backgroundColor: "#1D4745",
    },
    [Rarity.Epic]: {
        text: "#eb53ff",
        border: "#874C90",
        backgroundColor: "#614066",
    },
    [Rarity.Mythic]: {
        text: "#ff5252",
        border: "#C61014",
        backgroundColor: "#6F0000",
    },
};

export function getParameterByName<T extends string>(name: string, url?: string): T {
    const searchParams = new URLSearchParams(url || window.location.search);
    return (searchParams.get(name) || "") as T;
}

export const helpers = {
    getParameterByName,
    getCookie: function (cname: string) {
        const name = `${cname}=`;
        const decodedCookie = decodeURIComponent(document.cookie);
        const ca = decodedCookie.split(";");
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];

            while (c.charAt(0) == " ") {
                c = c.substring(1);
            }

            if (c.indexOf(name) == 0) {
                return c.substring(name.length, c.length);
            }
        }
        return "";
    },
    getGameModes: function () {
        const gameModes: {
            mapId: number;
            desc: {
                buttonCss: string;
                icon: string;
                name: string;
            };
        }[] = [];

        // Gather unique mapIds and assosciated map descriptions from the list of maps
        const mapKeys = Object.keys(MapDefs);
        for (let i = 0; i < mapKeys.length; i++) {
            const mapKey = mapKeys[i];
            const mapDef = MapDefs[mapKey as keyof typeof MapDefs];
            if (
                !gameModes.find((x) => {
                    return x.mapId == mapDef.mapId;
                })
            ) {
                gameModes.push({
                    mapId: mapDef.mapId,
                    desc: mapDef.desc,
                });
            }
        }
        gameModes.sort((a, b) => {
            return a.mapId - b.mapId;
        });
        return gameModes;
    },
    sanitizeNameInput: function (input: string) {
        let name = input.trim();
        if (name.length > net.Constants.PlayerNameMaxLen) {
            name = name.substring(0, net.Constants.PlayerNameMaxLen);
        }
        return name;
    },
    colorToHexString: function (c: number) {
        return `#${`000000${c.toString(16)}`.slice(-6)}`;
    },
    colorToDOMString: function (color: number, alpha: number) {
        return `rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${
            color & 255
        }, ${alpha})`;
    },
    getRarityVisuals: function (rarity?: number) {
        return (
            rarityVisuals[(rarity ?? Rarity.Stock) as Rarity] ||
            rarityVisuals[Rarity.Stock]
        );
    },
    getItemRarityStyleMarkup: function (gameType: string, rarity?: number) {
        const def = GameObjectDefs[gameType] as { type?: string } | undefined;
        const itemTypeClass = (() => {
            switch (def?.type) {
                case "outfit":
                    return "item-outfit";
                case "gun_skin":
                    return "item-gun-skin";
                case "melee":
                    return "item-melee";
                case "emote":
                    return "item-emote";
                case "heal":
                case "heal_effect":
                    return "item-heal_effect";
                case "boost":
                case "boost_effect":
                    return "item-boost_effect";
                case "death_effect":
                    return "item-deathEffect";
                case "crosshair":
                    return "item-crosshair";
                case "perk":
                    return "item-perk";
                case "streak":
                    return "item-streak";
                default:
                    return "";
            }
        })();
        if (!itemTypeClass) {
            return "";
        }
        const visuals = this.getRarityVisuals(rarity);
        return `<div class="item-rarity-style" style="background-color: ${visuals.border}; --item-rarity-color: ${visuals.border};"><div class="${itemTypeClass}"></div></div>`;
    },
    htmlEscape: function (str = "") {
        return str
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    },
    getClanTagHtml: function (clanName = "", tagColor = "") {
        if (!clanName) {
            return "";
        }
        const escapedTag = `[${this.htmlEscape(clanName)}]`;
        if (!tagColor) {
            return escapedTag;
        }
        const [start, end] = tagColor.split(",", 2);
        if (end) {
            return `<span style="display:inline-block;background-image:linear-gradient(90deg,${this.htmlEscape(start)},${this.htmlEscape(end)},${this.htmlEscape(start)});background-size:200% 100%;background-clip:text;-webkit-background-clip:text;color:transparent;-webkit-text-fill-color:transparent;text-shadow:none;animation:clan-gradient-shift 9s linear infinite">${escapedTag}</span>`;
        }
        return `<span style="color:${this.htmlEscape(tagColor)}">${escapedTag}</span>`;
    },
    truncateString: function (str: string, font: string, maxWidthPixels: number) {
        const context = truncateCanvas.getContext("2d")!;
        context.font = font;
        let truncated = str;
        for (
            let i = str.length;
            i > 0 && context.measureText(truncated).width > maxWidthPixels;
        ) {
            // Append an ellipses
            truncated = `${str.substring(0, --i)}…`;
        }
        return truncated;
    },
    toggleFullScreen: function (clear?: boolean) {
        let elem = document.documentElement;
        if (
            document.fullscreenElement ||
            document.mozFullScreenElement ||
            document.webkitFullscreenElement ||
            document.msFullscreenElement ||
            clear
        ) {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.msExitFullscreen) {
                // overwrite the element (for IE)
                document.msExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else {
                document.webkitExitFullscreen?.();
            }
        } else if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.msRequestFullscreen) {
            elem = document.body;
            elem.msRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
            elem.mozRequestFullScreen();
        } else {
            elem.webkitRequestFullscreen?.();
        }
    },
    copyTextToClipboard: function (text: string) {
        try {
            const $temp = $<HTMLInputElement>("<input>");
            $("body").append($temp);
            $temp.val(text);

            if (device.os == "ios") {
                const el = $temp.get(0)!;
                const editable = el.contentEditable;
                const readOnly = el.readOnly;
                el.contentEditable = "true";
                el.readOnly = true;
                const range = document.createRange();
                range.selectNodeContents(el);
                const sel = window.getSelection()!;
                sel.removeAllRanges();
                sel.addRange(range);
                el.setSelectionRange(0, 999999);
                el.contentEditable = editable;
                el.readOnly = readOnly;
            } else {
                $temp.trigger("select");
            }
            document.execCommand("copy");
            $temp.remove();
        } catch (_e) {}
    },
    formatTime(time: number) {
        const minutes = Math.floor(time / 60) % 60;
        let seconds: string | number = Math.floor(time) % 60;
        if (seconds < 10) {
            seconds = `0${seconds}`;
        }
        let timeSurv = "";
        timeSurv += `${minutes}:`;
        timeSurv += seconds;
        return timeSurv;
    },
    emoteImgToSvg(img: string) {
        return img && img.length > 4 ? `../img/emotes/${img.slice(0, -4)}.svg` : "";
    },
    getSvgFromGameType: function (gameType: string) {
        const def = GameObjectDefs[gameType] as any;
        const defType = def ? def.type : "";
        switch (defType) {
            case "gun_skin":
                return `img/guns/${def.worldImg.sprite.slice(0, -4)}.svg`;
            case "gun":
            case "melee":
            case "throwable":
            case "heal":
            case "boost":
            case "helmet":
            case "chest":
            case "scope":
            case "backpack":
            case "perk":
            case "xp":
            case "streak":
                return `img/loot/${def.lootImg?.sprite.slice(0, -4)}.svg`;
            case "heal_effect":
            case "boost_effect":
                return `img/particles/${def.texture?.slice(0, -4)}.svg`;
            case "death_effect":
                return `img/loot/${def.texture?.slice(0, -4)}.svg`;
            case "emote":
                return `img/emotes/${def.texture.slice(0, -4)}.svg`;
            case "crosshair":
                return `img/crosshairs/${def.texture.slice(0, -4)}.svg`;
            case "outfit": {
                const outfitDef = def as OutfitDef;
                const lootImg = getOutfitLootImg(outfitDef);
                if (outfitDef.lootImg.skinLootImg) {
                    queueOutfitSkinLootImage(gameType, outfitDef);
                    return (
                        outfitSkinLootImageCache.get(gameType) ??
                        `img/player/${lootImg.sprite.slice(0, -4)}.svg`
                    );
                }

                if (lootImg.sprite !== "loot-outfit-01.img") {
                    return `img/loot/${lootImg.sprite.slice(0, -4)}.svg`;
                }

                // tint outfits using loot-outfit-01
                const outfitSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><path d="M34.355 47.058c0 17.076 13.843 30.918 30.92 30.917 17.075 0 30.918-13.844 30.918-30.92 0-17.075-13.843-30.918-30.919-30.917s-30.919 13.844-30.919 30.92" fill="${this.colorToHexString(lootImg.tint)}"/><path d="M92.613 47.056c0-15.099-12.24-27.339-27.339-27.338s-27.339 12.24-27.339 27.34c0 15.098 12.24 27.338 27.34 27.337 15.098 0 27.338-12.24 27.338-27.34M65.274 12.558c19.053 0 34.499 15.444 34.499 34.497 0 19.054-15.446 34.5-34.499 34.5-19.053.001-34.499-15.444-34.499-34.497s15.446-34.5 34.5-34.5" fill="#000"/><path d="M64.275 107.558c-19.606.001-35.5-15.893-35.5-35.499s15.894-35.5 35.5-35.501 35.5 15.893 35.5 35.499-15.894 35.5-35.5 35.501Z" fill="${this.colorToHexString(lootImg.tint)}"/><path d="M23.99 103.054c0 6.783 5.5 12.283 12.285 12.284s12.285-5.496 12.285-12.279c0-6.784-5.5-12.284-12.285-12.285S23.99 96.27 23.99 103.054" fill="${this.colorToHexString(lootImg.tint)}"/><path d="M36.275 88.56c8.008.001 14.5 6.493 14.5 14.5s-6.492 14.495-14.5 14.494c-8.008-.002-14.5-6.494-14.5-14.5s6.492-14.496 14.5-14.495m10.07 14.499c0-5.56-4.508-10.069-10.07-10.07-5.56 0-10.069 4.505-10.069 10.066 0 5.56 4.508 10.068 10.07 10.069 5.56.001 10.069-4.505 10.069-10.065" fill="#000"/><path d="M80.99 103.054c0 6.783 5.5 12.283 12.285 12.284s12.285-5.496 12.285-12.279c0-6.784-5.5-12.284-12.285-12.285S80.99 96.27 80.99 103.054" fill="${this.colorToHexString(lootImg.tint)}"/><path d="M93.275 88.56c8.009.001 14.5 6.493 14.5 14.5s-6.491 14.495-14.5 14.494c-8.008-.002-14.5-6.494-14.5-14.5s6.492-14.496 14.5-14.495m10.07 14.499c0-5.56-4.508-10.069-10.07-10.07-5.56 0-10.069 4.505-10.069 10.066 0 5.56 4.508 10.068 10.07 10.069 5.56.001 10.069-4.505 10.069-10.065" fill="#000"/></svg>`;

                return URL.createObjectURL(
                    new Blob([outfitSvg], { type: "image/svg+xml;charset=utf-8" }),
                );
            }
            default:
                return "";
        }
    },
    getCssTransformFromGameType: function (gameType: string) {
        const def = GameObjectDefs[gameType] as MeleeDef | GunSkinDef;
        if (def?.type === "gun_skin") {
            return "rotate(45deg) scale(0.72)";
        }
        let transform = "";
        if (def?.type === "melee" && def.lootImg) {
            transform = `rotate(${def.lootImg.rot || 0}rad) scaleX(${
                def.lootImg.mirror ? -1 : 1
            })`;
        }
        return transform;
    },
    random64: function () {
        function r32() {
            return Math.floor(Math.random() * Math.pow(2, 32)).toString(16);
        }
        return r32() + r32();
    },
    verifyTurnstile: function (enabled: boolean, cb: (token: string) => void) {
        if (!enabled || !window.turnstile || !TURNSTILE_SITE_KEY) {
            cb("");
            return;
        }
        window.turnstile.render("#start-turnstile-container", {
            sitekey: TURNSTILE_SITE_KEY,
            appearance: "interaction-only",
            callback: (token: string) => {
                cb(token);
                window.turnstile.remove("#start-turnstile-container");
            },
        });
    },
};
