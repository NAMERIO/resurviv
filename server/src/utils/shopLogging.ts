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
    ip?: string;
    purchasedAt?: Date;
};

export function logMarketPurchaseToDiscord({
    buyerSlug,
    sellerSlug,
    itemType,
    price,
    ip,
    purchasedAt = new Date(),
}: ShopPurchaseLog) {
    if (process.env.NODE_ENV !== "production") return;
    if (!SHOP_LOGS_WEBHOOK) return;

    const buyer = sanitizeDiscordText(buyerSlug);
    const seller = sanitizeDiscordText(sellerSlug);
    const itemName = sanitizeDiscordText(getItemDisplayName(itemType));
    const formattedIp = ip ? sanitizeDiscordText(ip) : "unknown_ip";
    const formattedTime = formatEasternTime(purchasedAt);
    const message =
        `${buyer} bought ${itemName} (${itemType}) from ${seller} ` +
        `for ${price} GP | ${formattedIp} | ${formattedTime}`;

    return fetch(SHOP_LOGS_WEBHOOK, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            content: message,
        }),
    }).catch((err) => {
        defaultLogger.error("Failed to log market purchase to discord:", err);
    });
}
