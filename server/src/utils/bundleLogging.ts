import fs from "node:fs";
import path from "node:path";
import { type CanvasRenderingContext2D, createCanvas, loadImage } from "canvas";
import { GameObjectDefs } from "../../../shared/defs/gameObjectDefs";
import { getOutfitLootImg } from "../../../shared/defs/gameObjects/outfitDefs";
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

function formatDiscordTime(timestamp: number) {
    return `<t:${Math.floor(timestamp / 1000)}:R>`;
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

    ctx.fillStyle = borders[rarity] ?? borders[0]!;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 24, y);
    ctx.lineTo(x, y + 24);
    ctx.fill();
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
    const refreshesAt = offers[0]?.refreshesAt ?? Date.now();
    const hoursLeft = Math.max(0, Math.ceil((refreshesAt - Date.now()) / 3_600_000));
    ctx.fillText(`${String(hoursLeft).padStart(2, "0")}:00:00 remaining`, 600, 124);

    const potatoPath = publicAssetPath("img/gui/currency-golden-potato.svg");
    const potato = potatoPath
        ? await loadImage(potatoPath).catch(() => undefined)
        : undefined;

    for (const [index, offer] of offers.entries()) {
        const x = index === 0 ? 100 : 420;
        const width = index === 0 ? 260 : 680;
        ctx.fillStyle = "#874c90";
        drawRoundedRect(ctx, x, 172, width, 520, 10);
        ctx.fillStyle = "#252525";
        ctx.fillRect(x + 10, 182, width - 20, 432);

        const itemSize = 126;
        const columns = index === 0 ? 1 : 3;
        const rows = Math.ceil(offer.itemTypes.length / columns);
        const gridWidth = columns * itemSize + (columns - 1) * 14;
        const gridHeight = rows * itemSize + (rows - 1) * 14;
        const gridX = x + (width - gridWidth) / 2;
        const gridY = 182 + (432 - gridHeight) / 2;
        for (const [itemIndex, itemType] of offer.itemTypes.entries()) {
            await drawItem(
                ctx,
                itemType,
                gridX + (itemIndex % columns) * (itemSize + 14),
                gridY + Math.floor(itemIndex / columns) * (itemSize + 14),
                itemSize,
            );
        }

        const badgeWidth = Math.min(260, width - 40);
        const badgeX = x + (width - badgeWidth) / 2;
        ctx.fillStyle = "#f0df48";
        drawRoundedRect(ctx, badgeX, 192, badgeWidth, 42, 5);
        ctx.strokeStyle = "#c6ad1c";
        ctx.lineWidth = 3;
        ctx.strokeRect(badgeX, 192, badgeWidth, 42);
        ctx.fillStyle = "#aa1313";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(offer.name, x + width / 2, 220, badgeWidth - 16);

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
    const image = await renderBundleCard(offers);
    const refreshesAt = offers[0]?.refreshesAt ?? Date.now();
    const formData = new FormData();
    const imageData = new ArrayBuffer(image.byteLength);
    new Uint8Array(imageData).set(image);
    formData.append(
        "file",
        new Blob([imageData], { type: "image/png" }),
        "featured-bundles.png",
    );
    formData.append(
        "payload_json",
        JSON.stringify({
            username: "Resurviv Shop",
            embeds: [
                {
                    title: "🛍️ New Featured Bundles!",
                    description: `Two fresh bundles are now live. They refresh ${formatDiscordTime(refreshesAt)}.`,
                    color: 0x26d7a0,
                    fields: offers.map((offer) => ({
                        name: `${offer.size === "small" ? "💠" : "💎"} ${offer.name}`,
                        value: `**${offer.price.toLocaleString()} GP**\n${offer.itemTypes.map((type) => (GameObjectDefs[type] as any)?.name ?? type).join(" • ")}`,
                        inline: false,
                    })),
                    image: { url: "attachment://featured-bundles.png" },
                    footer: { text: "Resurviv • Featured Shop Rotation" },
                    timestamp: new Date().toISOString(),
                },
            ],
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
