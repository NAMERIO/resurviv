import $ from "jquery";
import type { FreeFallTicketState } from "../../../shared/types/user";
import ticketArt from "./ticket.svg?raw";

const CARD_ID = "ff-shop-card";
const DAY_MS = 24 * 60 * 60 * 1000;

function daysLeftText(expiresAt: number) {
    const days = Math.ceil((expiresAt - Date.now()) / DAY_MS);
    return days === 1 ? "1 day left" : `${days} days left`;
}

export function renderFreeFallShopCard(ticket: FreeFallTicketState | null) {
    let card = $(`#${CARD_ID}`);
    if (!ticket) {
        card.remove();
        return;
    }

    if (!card.length) {
        card = $("<div/>", { id: CARD_ID, class: "ff-shop-card" }).html(`
            <div class="ff-shop-card__art">${ticketArt}</div>
            <div class="ff-shop-card__row">
                <span class="ff-shop-card__status">Your shop is free</span>
                <span class="ff-shop-card__days"></span>
            </div>
            <div class="ff-shop-card__rule">Sellers still get paid. Anything you get free stays yours and can't be sold or gifted.</div>
        `);
        $(".iap-gp").prepend(card);
    }

    card.find(".ff-shop-card__days").text(daysLeftText(ticket.expiresAt));
}
