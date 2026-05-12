import { GameObjectDefs } from "../../../shared/defs/gameObjectDefs";
import { Config } from "../config";
import { defaultLogger } from "./logger";

const SHOP_LOGS_WEBHOOK = Config.webhooks?.shopLogs;

function sanitizeDiscordText(value: string) {
    return value.replaceAll("@", "(at)");
}

function formatEasternTime(date = new Date()) {
    return new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short",
    }).format(date);
}

function getItemDisplayName(itemType: string) {
    const itemDef = GameObjectDefs[itemType] as { name?: string } | undefined;
    return itemDef?.name || itemType;
}

type ShopPurchaseLog = {
    buyerSlug: string;
    sellerSlug: string;
    itemType: string;
    price: number;
    purchasedAt?: Date;
};

type GpGiftLog = {
    senderSlug: string;
    recipientSlug: string;
    amount: number;
    giftedAt?: Date;
};

type ItemGiftLog = {
    senderSlug: string;
    recipientSlug: string;
    itemTypes: string[];
    giftedAt?: Date;
};

function sendShopLog(message: string, errorMessage: string) {
    if (process.env.NODE_ENV !== "production") return;
    if (!SHOP_LOGS_WEBHOOK) return;

    return fetch(SHOP_LOGS_WEBHOOK, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            content: message,
        }),
    }).catch((err) => {
        defaultLogger.error(errorMessage, err);
    });
}

export function logMarketPurchaseToDiscord({
    buyerSlug,
    sellerSlug,
    itemType,
    price,
    purchasedAt = new Date(),
}: ShopPurchaseLog) {
    const buyer = sanitizeDiscordText(buyerSlug);
    const seller = sanitizeDiscordText(sellerSlug);
    const itemName = sanitizeDiscordText(getItemDisplayName(itemType));
    const formattedTime = formatEasternTime(purchasedAt);
    const message =
        `${buyer} bought ${itemName} (${itemType}) from ${seller} ` +
        `for ${price} GP | ${formattedTime}`;

    return sendShopLog(message, "Failed to log market purchase to discord:");
}

export function logGpGiftToDiscord({
    senderSlug,
    recipientSlug,
    amount,
    giftedAt = new Date(),
}: GpGiftLog) {
    const sender = sanitizeDiscordText(senderSlug);
    const recipient = sanitizeDiscordText(recipientSlug);
    const formattedTime = formatEasternTime(giftedAt);
    const message = `${sender} gifted ${amount} GP to ${recipient} | ${formattedTime}`;

    return sendShopLog(message, "Failed to log GP gift to discord:");
}

export function logItemGiftToDiscord({
    senderSlug,
    recipientSlug,
    itemTypes,
    giftedAt = new Date(),
}: ItemGiftLog) {
    const sender = sanitizeDiscordText(senderSlug);
    const recipient = sanitizeDiscordText(recipientSlug);
    const items = itemTypes
        .map((itemType) => {
            const itemName = sanitizeDiscordText(getItemDisplayName(itemType));
            return `${itemName} (${itemType})`;
        })
        .join(", ");
    const formattedTime = formatEasternTime(giftedAt);
    const message = `${sender} gifted ${items} to ${recipient} | ${formattedTime}`;

    return sendShopLog(message, "Failed to log item gift to discord:");
}
