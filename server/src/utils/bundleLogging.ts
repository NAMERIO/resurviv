import fs from "node:fs";
import path from "node:path";
import { type CanvasRenderingContext2D, createCanvas, loadImage } from "canvas";
import { GameObjectDefs } from "../../../shared/defs/gameObjectDefs";
import {
    getOutfitLootImg,
    type OutfitDef,
} from "../../../shared/defs/gameObjects/outfitDefs";
import { Rarity } from "../../../shared/gameConfig";
import {
    type FeaturedBundleOffer,
    getFeaturedBundleOffers,
} from "../../../shared/utils/featuredBundles";
import { Config } from "../config";

const CHECK_DELAY_MS = 1_000;
const RETRY_DELAY_MS = 60_000;
let currentRotationId: string | undefined;
let rotationTimer: ReturnType<typeof setTimeout> | undefined;

const bundleThemes: Record<
    FeaturedBundleOffer["rarity"],
    { color: string; dark: string; border: string; accent: string }
> = {
    uncommon: {
        color: "#465c33",
        dark: "#2d3b21",
        border: "#80b251",
        accent: "#1dff55",
    },
    rare: {
        color: "#244b82",
        dark: "#152d50",
        border: "#4f8edc",
        accent: "#78b7ff",
    },
    epic: {
        color: "#614066",
        dark: "#3f2943",
        border: "#874c90",
        accent: "#eb53ff",
    },
    legendary: {
        color: "#8a3f1f",
        dark: "#51200f",
        border: "#ff7a45",
        accent: "#ffac7a",
    },
    mythic: {
        color: "#6f0000",
        dark: "#420000",
        border: "#c61014",
        accent: "#ff5252",
    },
    divine: {
        color: "#7d2057",
        dark: "#48102f",
        border: "#f23a8f",
        accent: "#ff75bb",
    },
    exclusive: {
        color: "#7b5916",
        dark: "#463008",
        border: "#e6b83f",
        accent: "#ffe27a",
    },
};

function itemImagePath(itemType: string) {
    const def = GameObjectDefs[itemType] as any;
    let relativePath = "";
    if (def?.type === "gun_skin") {
        relativePath = `img/guns/${def.worldImg.sprite.slice(0, -4)}.svg`;
    } else if (def?.type === "outfit") {
        const lootImg = getOutfitLootImg(def);
        const folder = def.lootImg.skinLootImg ? "player" : "loot";
        relativePath = `img/${folder}/${lootImg.sprite.slice(0, -4)}.svg`;
    } else if (def?.type === "emote") {
        relativePath = `img/emotes/${def.texture.slice(0, -4)}.svg`;
    } else if (def?.lootImg?.sprite) {
        relativePath = `img/loot/${def.lootImg.sprite.slice(0, -4)}.svg`;
    }
    if (!relativePath) return undefined;

    return publicAssetPath(relativePath);
}

function publicAssetPath(relativePath: string) {
    const roots = [
        path.resolve(process.cwd(), "client/public"),
        path.resolve(process.cwd(), "../client/public"),
    ];
    return roots.map((root) => path.join(root, relativePath)).find(fs.existsSync);
}

type OutfitPreviewLayer = {
    sprite: string;
    tint: number;
    scale: number;
    x: number;
    y: number;
};

function getOutfitPreviewLayers(def: OutfitDef): OutfitPreviewLayer[] {
    const img = def.skinImg;
    const accessory: OutfitPreviewLayer[] = img.frontSprite
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
    const hands: OutfitPreviewLayer[] = [
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

function playerSpritePath(sprite: string) {
    return publicAssetPath(`img/player/${sprite.slice(0, -4)}.svg`);
}

async function drawTintedImage(
    ctx: CanvasRenderingContext2D,
    imagePath: string,
    x: number,
    y: number,
    width: number,
    height: number,
    tint = 0xffffff,
) {
    const image = await loadImage(imagePath);
    if (tint === 0xffffff) {
        ctx.drawImage(image, x, y, width, height);
        return;
    }

    const buffer = createCanvas(
        Math.max(1, Math.ceil(width)),
        Math.max(1, Math.ceil(height)),
    );
    const bufferCtx = buffer.getContext("2d");
    bufferCtx.drawImage(image, 0, 0, buffer.width, buffer.height);
    bufferCtx.globalCompositeOperation = "multiply";
    bufferCtx.fillStyle = `#${tint.toString(16).padStart(6, "0")}`;
    bufferCtx.fillRect(0, 0, buffer.width, buffer.height);
    bufferCtx.globalCompositeOperation = "destination-in";
    bufferCtx.drawImage(image, 0, 0, buffer.width, buffer.height);
    ctx.drawImage(buffer, x, y, width, height);
}

async function drawOutfitPreview(
    ctx: CanvasRenderingContext2D,
    def: OutfitDef,
    x: number,
    y: number,
    size: number,
) {
    const previewScale = (size / 66) * 0.8;
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2 + 3 * previewScale);
    ctx.rotate(Math.PI / 2);

    for (const layer of getOutfitPreviewLayers(def)) {
        const imagePath = playerSpritePath(layer.sprite);
        if (!imagePath) continue;

        try {
            const image = await loadImage(imagePath);
            const width = image.width * layer.scale * previewScale;
            const height = image.height * layer.scale * previewScale;
            await drawTintedImage(
                ctx,
                imagePath,
                layer.x * previewScale - width / 2,
                layer.y * previewScale - height / 2,
                width,
                height,
                layer.tint,
            );
        } catch {}
    }

    ctx.restore();
}

function itemTypeIconPath(itemType: string) {
    const def = GameObjectDefs[itemType] as { type?: string } | undefined;
    const relativePath = (() => {
        switch (def?.type) {
            case "outfit":
                return "img/gui/item-outfit-style.svg";
            case "gun_skin":
                return "img/loot/loot-weapon-mosin.svg";
            case "melee":
                return "img/gui/item-melee-style.svg";
            case "emote":
                return "img/gui/item-emote-style.svg";
            case "heal":
            case "heal_effect":
                return "img/gui/item-heal-style.svg";
            case "boost":
            case "boost_effect":
                return "img/gui/item-boost-style.svg";
            case "death_effect":
                return "img/gui/item-deathEffect-style.svg";
            case "crosshair":
                return "img/gui/item-crosshair-style.svg";
            default:
                return undefined;
        }
    })();
    return relativePath ? publicAssetPath(relativePath) : undefined;
}

function formatDiscordTime(timestamp: number) {
    return `<t:${Math.floor(timestamp / 1000)}:R>`;
}

function formatBundleCountdown(timeMs: number) {
    const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return days > 0
        ? `${days}d ${hours}h ${minutes}m ${seconds}s`
        : `${hours}h ${minutes}m ${seconds}s`;
}

function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
}

async function drawItem(
    ctx: CanvasRenderingContext2D,
    itemType: string,
    x: number,
    y: number,
    size: number,
) {
    const def = GameObjectDefs[itemType] as any;
    const rarity = Number(def?.rarity ?? Rarity.Stock);
    const backgrounds = [
        "#282828",
        "#3e3e3e",
        "#465c33",
        "#1d4745",
        "#614066",
        "#6f0000",
    ];
    const borders = ["#969696", "#a1a1a1", "#80b251", "#50afab", "#874c90", "#c61014"];
    ctx.fillStyle = backgrounds[rarity] ?? backgrounds[0]!;
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = borders[rarity] ?? borders[0]!;
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);

    if (def?.type === "outfit" && (def as OutfitDef).lootImg.skinLootImg) {
        await drawOutfitPreview(ctx, def as OutfitDef, x, y, size);
    } else {
        const imagePath = itemImagePath(itemType);
        if (imagePath) {
            try {
                const image = await loadImage(imagePath);
                const scale = Math.min(
                    (size * 0.72) / image.width,
                    (size * 0.72) / image.height,
                );
                const imageWidth = image.width * scale;
                const imageHeight = image.height * scale;
                ctx.drawImage(
                    image,
                    x + (size - imageWidth) / 2,
                    y + (size - imageHeight) / 2,
                    imageWidth,
                    imageHeight,
                );
            } catch {}
        }
    }

    ctx.fillStyle = borders[rarity] ?? borders[0]!;
    ctx.fillRect(x, y, 28, 28);

    const iconPath = itemTypeIconPath(itemType);
    if (iconPath) {
        try {
            const icon = await loadImage(iconPath);
            const iconScale = Math.min(18 / icon.width, 18 / icon.height);
            const iconWidth = icon.width * iconScale;
            const iconHeight = icon.height * iconScale;
            ctx.drawImage(
                icon,
                x + (28 - iconWidth) / 2,
                y + (28 - iconHeight) / 2,
                iconWidth,
                iconHeight,
            );
        } catch {}
    }
}

export async function renderBundleCard(offers: FeaturedBundleOffer[]) {
    const canvas = createCanvas(1200, 760);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#3a3a3a";
    ctx.fillRect(0, 0, 1200, 760);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 50px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Featured", 600, 70);
    ctx.fillStyle = "#1f1e1e";
    drawRoundedRect(ctx, 354, 92, 492, 48, 3);
    ctx.fillStyle = "#dfe412";
    ctx.font = "23px sans-serif";
    const refreshesAt = offers.length
        ? Math.min(...offers.map((offer) => offer.refreshesAt))
        : Date.now();
    ctx.fillText(
        `${formatBundleCountdown(refreshesAt - Date.now())} remaining`,
        600,
        124,
    );

    const potatoPath = publicAssetPath("img/gui/currency-golden-potato.svg");
    const potato = potatoPath
        ? await loadImage(potatoPath).catch(() => undefined)
        : undefined;

    const visibleOffers = [...offers]
        .sort((a, b) => (a.size === "small" ? -1 : 1) - (b.size === "small" ? -1 : 1))
        .slice(0, 2);
    for (const offer of visibleOffers) {
        const isSmall = offer.size === "small";
        const x = isSmall ? 100 : 420;
        const width = isSmall ? 260 : 680;
        const theme = bundleThemes[offer.rarity];
        ctx.fillStyle = theme.color;
        drawRoundedRect(ctx, x, 172, width, 520, 10);
        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 5;
        ctx.stroke();

        ctx.fillStyle = theme.color;
        ctx.fillRect(x + 10, 182, width - 20, 70);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(offer.name, x + width / 2, 225, width - 40);

        ctx.fillStyle = theme.dark;
        ctx.fillRect(x + 10, 252, width - 20, 34);
        ctx.fillStyle = theme.accent;
        ctx.font = "18px sans-serif";
        ctx.fillText(
            formatBundleCountdown(offer.refreshesAt - Date.now()),
            x + width / 2,
            276,
            width - 40,
        );

        ctx.fillStyle = "#252525";
        ctx.fillRect(x + 10, 286, width - 20, 328);

        const itemSize = 126;
        const columns = isSmall ? 1 : 3;
        const rows = Math.ceil(offer.itemTypes.length / columns);
        const gridWidth = columns * itemSize + (columns - 1) * 14;
        const gridHeight = rows * itemSize + (rows - 1) * 14;
        const gridX = x + (width - gridWidth) / 2;
        const gridY = 286 + (328 - gridHeight) / 2;
        for (const [itemIndex, itemType] of offer.itemTypes.entries()) {
            await drawItem(
                ctx,
                itemType,
                gridX + (itemIndex % columns) * (itemSize + 14),
                gridY + Math.floor(itemIndex / columns) * (itemSize + 14),
                itemSize,
            );
        }

        const priceGradient = ctx.createLinearGradient(0, 630, 0, 678);
        priceGradient.addColorStop(0, "#f4f4d1");
        priceGradient.addColorStop(0.55, "#ced200");
        priceGradient.addColorStop(1, "#cbb814");
        ctx.fillStyle = priceGradient;
        ctx.font = "bold 39px sans-serif";
        const priceText = offer.price.toLocaleString();
        const iconWidth = potato ? 34 : 0;
        const iconGap = potato ? 18 : 0;
        const priceWidth = ctx.measureText(priceText).width;
        const priceStart = x + (width - iconWidth - iconGap - priceWidth) / 2;
        if (potato) ctx.drawImage(potato, priceStart, 632, iconWidth, 43);
        ctx.textAlign = "left";
        ctx.fillText(priceText, priceStart + iconWidth + iconGap, 670);
    }
    return canvas.toBuffer("image/png");
}

async function postBundleRotation(offers: FeaturedBundleOffer[]) {
    const webhook = Config.webhooks?.bundleRotation;
    if (!webhook) throw new Error("The bundle rotation webhook is not configured");
    const pages = [...new Set(offers.map((offer) => offer.page))]
        .sort((a, b) => a - b)
        .map((page) => offers.filter((offer) => offer.page === page));
    if (pages.length > 10) {
        throw new Error("Discord supports at most 10 featured bundle pages per webhook");
    }

    const formData = new FormData();
    const embeds = [];

    for (const [index, pageOffers] of pages.entries()) {
        const image = await renderBundleCard(pageOffers);
        const imageData = new ArrayBuffer(image.byteLength);
        new Uint8Array(imageData).set(image);
        const filename = `featured-bundles-${index + 1}.png`;
        formData.append(
            `files[${index}]`,
            new Blob([imageData], { type: "image/png" }),
            filename,
        );

        const refreshesAt = pageOffers.length
            ? Math.min(...pageOffers.map((offer) => offer.refreshesAt))
            : Date.now();
        embeds.push({
            title: `New Featured Bundles! (${index + 1}/${pages.length})`,
            description: `This bundle page refreshes ${formatDiscordTime(refreshesAt)}.`,
            color: 0x26d7a0,
            fields: pageOffers.map((offer) => ({
                name: `${offer.size === "small" ? "Small" : "Large"} | ${offer.name}`,
                value: `**${offer.price.toLocaleString()} GP**\n${offer.itemTypes.map((type) => (GameObjectDefs[type] as any)?.name ?? type).join(" • ")}`,
                inline: false,
            })),
            image: { url: `attachment://${filename}` },
            footer: { text: "Resurviv | Featured Shop Rotation" },
            timestamp: new Date().toISOString(),
        });
    }

    formData.append(
        "payload_json",
        JSON.stringify({
            username: "Resurviv Shop",
            embeds,
        }),
    );
    const response = await fetch(webhook, { method: "POST", body: formData });
    if (!response.ok) throw new Error(`Discord returned HTTP ${response.status}`);
    return true;
}

export async function sendCurrentBundleRotation() {
    await postBundleRotation(
        getFeaturedBundleOffers(Date.now(), Config.featuredBundleResetAt).offers,
    );
}

async function checkBundleRotation() {
    const { window, offers } = getFeaturedBundleOffers(
        Date.now(),
        Config.featuredBundleResetAt,
    );
    const rotationId = offers.map((offer) => offer.id).join(":");
    if (currentRotationId === undefined) {
        currentRotationId = rotationId;
    } else if (rotationId !== currentRotationId) {
        try {
            await postBundleRotation(offers);
            currentRotationId = rotationId;
        } catch (error) {
            console.error("Failed to announce featured bundles", error);
            rotationTimer = setTimeout(checkBundleRotation, RETRY_DELAY_MS);
            rotationTimer.unref();
            return;
        }
    }
    rotationTimer = setTimeout(
        checkBundleRotation,
        Math.max(CHECK_DELAY_MS, window.refreshesAt - Date.now() + CHECK_DELAY_MS),
    );
    rotationTimer.unref();
}

export function startBundleRotationLogging() {
    if (!Config.webhooks?.bundleRotation || rotationTimer) return;
    void checkBundleRotation();
}
