import $ from "jquery";
import { isFreeFallTicketLive } from "../../../shared/defs/gameObjects/freeFallTicketDefs";
import type { FreeFallTicketState } from "../../../shared/types/user";

const BADGE_ID = "ff-shop-badge";
const DAY_MS = 24 * 60 * 60 * 1000;

function daysLeftText(expiresAt: number) {
    const days = Math.ceil((expiresAt - Date.now()) / DAY_MS);
    return days === 1 ? "1 day left" : `${days} days left`;
}

export function renderFreeFallShopCard(ticket: FreeFallTicketState | null) {
    $("#ff-shop-event").toggle(isFreeFallTicketLive());

    let badge = $(`#${BADGE_ID}`);
    if (!ticket) {
        badge.remove();
        return;
    }

    if (!badge.length) {
        badge = $("<div/>", {
            id: BADGE_ID,
            class: "ff-shop-badge",
            title: "Bundles, market items and crates are free. Sellers still get paid, but free items can't be sold or gifted.",
        }).html(`
            <img class="ff-shop-badge__icon" src="/img/loot/loot-free-fall-ticket.svg" alt="" />
            <span class="ff-shop-badge__name">Free Fall Ticket</span>
            <span class="ff-shop-badge__days"></span>
        `);
        $("#shop-balance-bar").append(badge);
    }

    badge.find(".ff-shop-badge__days").text(daysLeftText(ticket.expiresAt));
}
