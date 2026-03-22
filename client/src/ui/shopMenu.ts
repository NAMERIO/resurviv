import $ from "jquery";
import { GameObjectDefs } from "../../../shared/defs/gameObjectDefs";
import { Rarity } from "../../../shared/gameConfig";
import {
    getMarketPriceBounds,
    getSuggestedMarketSellPrice,
} from "../../../shared/utils/marketPricing";
import type { Account } from "../account";
import { helpers } from "../helpers";
import type { Localization } from "./localization";
import { MenuModal } from "./menuModal";

type ShopTab = "shop" | "buy" | "sell";
type MarketSort = "price" | "item" | "rarity";
type MarketOrder = "lowhigh" | "highlow";

type Listing = {
    id?: string;
    itemId?: string;
    type: string;
    category: string;
    name: string;
    rarity: number;
    image: string;
    transform: string;
    price: number;
    owned?: boolean;
    action: "buy" | "sell" | "cancel";
    sellerName?: string;
    createdAt?: number;
};

const supportedMarketTypes = new Set([
    "outfit",
    "melee",
    "emote",
    "heal_effect",
    "boost_effect",
    "death_effect",
]);

const rarityL10n: Record<number, string> = {
    [Rarity.Stock]: "loadout-stock",
    [Rarity.Common]: "loadout-common",
    [Rarity.Uncommon]: "loadout-uncommon",
    [Rarity.Rare]: "loadout-rare",
    [Rarity.Epic]: "loadout-epic",
    [Rarity.Mythic]: "loadout-mythic",
};

const categoryL10n: Record<string, string> = {
    outfit: "market-type-outfit",
    melee: "market-type-melee",
    emote: "market-type-emote",
    heal_effect: "market-type-heal",
    boost_effect: "market-type-boost",
    death_effect: "market-type-deathEffect",
};

export class ShopMenu {
    modal = new MenuModal($("#iap-modal"));
    confirmSellModal = new MenuModal($("#modal-confirm-sell"));
    marketTimerId: number | null = null;
    pendingSellItem: Listing | null = null;
    pendingAction: "sell" | "cancel" = "sell";
    activeTab: ShopTab = "shop";
    marketType = "all";
    marketRarity = "all";
    marketSort: MarketSort = "price";
    marketOrder: MarketOrder = "lowhigh";
    marketBuyListings: Listing[] = [];
    marketSellListings: Listing[] = [];
    gpBalance = 0;

    constructor(
        public account: Account,
        public localization: Localization,
    ) {
        this.bindUi();
        this.account.addEventListener("items", () => {
            this.refreshData();
            this.render();
        });
        this.account.addEventListener("market", () => {
            this.refreshData();
            this.render();
        });
        this.account.addEventListener("gpBalance", () => {
            this.renderBalance();
        });
        this.account.addEventListener("login", () => {
            this.refreshData();
            this.render();
        });
        this.refreshData();
        this.render();
    }

    bindUi() {
        this.modal.onShow(() => {
            this.refreshData();
            this.render();
            this.startMarketTimers();
            this.account.loadMarket((success) => {
                if (!success) {
                    this.setStatus("shop-market-load-failed");
                }
            });
        });
        this.modal.onHide(() => {
            this.stopMarketTimers();
        });

        this.confirmSellModal.onHide(() => {
            this.pendingSellItem = null;
            $("#confirm-sell-price-range").hide();
            $("#confirm-sell-price-error").text("").hide();
        });

        $("#start-shop-shortcut, #open-store-button").on("click", (e) => {
            e.preventDefault();
            this.modal.show(true);
            return false;
        });

        $("#confirm-sell-yes").on("click", (e) => {
            e.preventDefault();
            const item = this.pendingSellItem;
            const action = this.pendingAction;
            if (!item) return false;
            if (action === "cancel") {
                this.confirmSellModal.hide();
                if (!item.id) return false;
                this.account.cancelMarketListing(item.id, (error) => {
                    this.setStatus(
                        error
                            ? `shop-market-error-${error}`
                            : "shop-market-cancel-success",
                    );
                });
                return false;
            }

            const price = this.getPendingSellPrice();
            if (price === null) {
                return false;
            }

            this.confirmSellModal.hide();
            if (!item.itemId) return false;
            this.account.createMarketListing(item.itemId, price, (error) => {
                this.setStatus(
                    error ? `shop-market-error-${error}` : "shop-market-sell-success",
                );
            });
            return false;
        });

        $("#confirm-sell-no").on("click", (e) => {
            e.preventDefault();
            this.confirmSellModal.hide();
            return false;
        });

        $("#confirm-sell-price-input").on("input", () => {
            if (this.pendingAction === "sell") {
                this.updateSellPriceValidation();
            }
        });

        $("#tab-shop").on("click", () => this.setTab("shop"));
        $("#tab-market-buy").on("click", () => this.setTab("buy"));
        $("#tab-market-sell").on("click", () => this.setTab("sell"));

        $("#market-type-select").on("change", (e) => {
            this.marketType = String((e.target as HTMLSelectElement).value);
            this.syncFilterLabels();
        });
        $("#market-rarity-select").on("change", (e) => {
            this.marketRarity = String((e.target as HTMLSelectElement).value);
            this.syncFilterLabels();
        });
        $("#market-sort-select").on("change", (e) => {
            this.marketSort = (e.target as HTMLSelectElement).value as MarketSort;
            this.syncFilterLabels();
        });
        $("#market-mode-select").on("change", (e) => {
            this.marketOrder = (e.target as HTMLSelectElement).value as MarketOrder;
            this.syncFilterLabels();
        });
        $("#market-btn-search-items").on("click", () => this.renderMarket());

        this.bindDesktopFilter(
            "#market-change-type",
            "#market-change-type-selection",
            "#market-type-select",
            (value) => {
                this.marketType = value;
            },
        );
        this.bindDesktopFilter(
            "#market-change-rarity",
            "#market-change-rarity-selection",
            "#market-rarity-select",
            (value) => {
                this.marketRarity = value;
            },
        );
        this.bindDesktopFilter(
            "#market-change-sort",
            "#market-change-sort-selection",
            "#market-sort-select",
            (value) => {
                this.marketSort = value as MarketSort;
            },
        );
        this.bindDesktopFilter(
            "#market-change-mode",
            "#market-change-mode-selection",
            "#market-mode-select",
            (value) => {
                this.marketOrder = value as MarketOrder;
            },
        );
    }

    bindDesktopFilter(
        triggerSelector: string,
        panelSelector: string,
        selectSelector: string,
        onChange: (value: string) => void,
    ) {
        $(triggerSelector).on("click", (e) => {
            e.stopPropagation();
            const panel = $(panelSelector);
            $(".market-change-selection").not(panel).hide();
            panel.toggle();
        });

        $(`${panelSelector} .right-market-btn`).on("click", (e) => {
            e.stopPropagation();
            const option = e.currentTarget as HTMLElement;
            const value = option.id;
            $(selectSelector).val(value);
            onChange(value);
            $(panelSelector).hide();
            this.syncFilterLabels();
            this.renderMarket();
        });

        $(document).on("click", (e) => {
            if (
                $(e.target).closest(`${triggerSelector}, ${panelSelector}`).length === 0
            ) {
                $(panelSelector).hide();
            }
        });
    }

    refreshData() {
        this.marketBuyListings = this.buildMarketBuyListings();
        this.marketSellListings = this.buildMarketSellListings();
    }

    setTab(tab: ShopTab) {
        this.activeTab = tab;
        $("#tab-shop, #tab-market-buy, #tab-market-sell").removeClass(
            "store-tab-selected",
        );
        $(
            `#tab-${tab === "buy" ? "market-buy" : tab === "sell" ? "market-sell" : "shop"}`,
        ).addClass("store-tab-selected");

        const shopVisible = tab === "shop";
        $(".iap-container").css("display", shopVisible ? "flex" : "none");
        $(".market-container").css("display", shopVisible ? "none" : "flex");
        $(".market-locked-container").css("display", "none");
        if (!shopVisible) {
            this.renderMarket();
        }
    }

    buildMarketBuyListings() {
        return this.account.marketListings
            .map((listing) => {
                const def = GameObjectDefs[listing.itemType] as any;
                if (!def || !supportedMarketTypes.has(def.type)) return null;
                return {
                    id: listing.id,
                    itemId: listing.itemId,
                    type: listing.itemType,
                    category: def.type,
                    name:
                        this.localization.translate(`game-${listing.itemType}`) ||
                        def.name ||
                        listing.itemType,
                    rarity: def.rarity ?? Rarity.Stock,
                    image: helpers.getSvgFromGameType(listing.itemType),
                    transform: helpers.getCssTransformFromGameType(listing.itemType),
                    price: listing.price,
                    owned: this.account.items.some(
                        (item) => item.type === listing.itemType,
                    ),
                    action: "buy",
                    sellerName: listing.sellerSlug,
                    createdAt: listing.createdAt,
                } as Listing;
            })
            .filter((item): item is Listing => item !== null);
    }

    buildMarketSellListings() {
        const listedItemIds = new Set(
            this.account.userMarketListings.map((listing) => listing.itemId),
        );
        const activeListings = this.account.userMarketListings
            .map((listing) => {
                const def = GameObjectDefs[listing.itemType] as any;
                if (!def || !supportedMarketTypes.has(def.type)) return null;
                return {
                    id: listing.id,
                    itemId: listing.itemId,
                    type: listing.itemType,
                    category: def.type,
                    name:
                        this.localization.translate(`game-${listing.itemType}`) ||
                        def.name ||
                        listing.itemType,
                    rarity: def.rarity ?? Rarity.Stock,
                    image: helpers.getSvgFromGameType(listing.itemType),
                    transform: helpers.getCssTransformFromGameType(listing.itemType),
                    price: listing.price,
                    owned: true,
                    action: "cancel",
                    sellerName: this.localization.translate("market-you") || "You",
                    createdAt: listing.createdAt,
                } as Listing;
            })
            .filter((item): item is Listing => item !== null);

        const sellableItems = this.account.items
            .map((item) => {
                const def = GameObjectDefs[item.type] as any;
                if (!def || !supportedMarketTypes.has(def.type)) return null;
                const rarity = def.rarity ?? Rarity.Stock;
                if (rarity < Rarity.Rare) return null;
                if (!item.id || listedItemIds.has(item.id)) return null;
                return {
                    itemId: item.id,
                    type: item.type,
                    category: def.type,
                    name:
                        this.localization.translate(`game-${item.type}`) ||
                        def.name ||
                        item.type,
                    rarity,
                    image: helpers.getSvgFromGameType(item.type),
                    transform: helpers.getCssTransformFromGameType(item.type),
                    price: getSuggestedMarketSellPrice(item.type) ?? 0,
                    owned: true,
                    action: "sell",
                    sellerName: this.localization.translate("market-you") || "You",
                } as Listing;
            })
            .filter((item): item is Listing => item !== null)
            .sort((a, b) => b.price - a.price);

        return [...activeListings, ...sellableItems];
    }

    render() {
        this.renderFeatured();
        this.renderBalance();
        this.syncFilterLabels();
        this.setTab(this.activeTab);
    }

    renderBalance() {
        this.gpBalance = this.account.gpBalance;
        $("#shop-gp-balance").text(String(this.gpBalance));
        $("#start-gp-display-amount, .currency-text").text(String(this.gpBalance));
    }

    renderFeatured() {
        $("#iap-lto-time-left-number").text("00:00:00:00");
        $("#iap-lto-pack-1 .iap-currency-text").text("850");
        $("#iap-lto-pack-2 .iap-currency-text").text("2200");
        $("#iap-lto-pack-1 .iap-discount").text("QUEST");
        $("#iap-lto-pack-2 .iap-discount").text("PLAY");
        $("#iap-lto-pack-1, #iap-lto-pack-2").off("click");
    }

    syncFilterLabels() {
        const typeKey = categoryL10n[this.marketType] || "market-all";
        const rarityKey =
            this.marketRarity === "all"
                ? "market-all"
                : rarityL10n[Number(this.marketRarity)] || "market-all";
        const sortKey =
            this.marketSort === "item"
                ? "market-sort-item"
                : this.marketSort === "rarity"
                  ? "loadout-rarity"
                  : "market-sort-price";
        const orderKey =
            this.marketOrder === "highlow"
                ? "market-mode-highlow"
                : "market-mode-lowhigh";

        $("#market-type-selected")
            .attr("data-l10n", typeKey)
            .text(this.localization.translate(typeKey) || "All");
        $("#market-type-selected").css(
            "background-image",
            this.marketType === "all"
                ? ""
                : this.marketType === "death_effect"
                  ? "url(img/emotes/tombstone.svg)"
                  : `url(img/gui/loadout-${this.marketType.replace("_effect", "")}.svg)`,
        );
        $("#market-type-selected").toggleClass(
            "right-market-btn-img",
            this.marketType !== "all",
        );
        $("#market-rarity-selected")
            .attr("data-l10n", rarityKey)
            .text(this.localization.translate(rarityKey) || "All");
        $("#market-sort-selected")
            .attr("data-l10n", sortKey)
            .text(this.localization.translate(sortKey) || "Price");
        $("#market-mode-selected")
            .attr("data-l10n", orderKey)
            .text(this.localization.translate(orderKey) || "Low to High");

        $("#market-type-select").val(this.marketType);
        $("#market-rarity-select").val(this.marketRarity);
        $("#market-sort-select").val(this.marketSort);
        $("#market-mode-select").val(this.marketOrder);

        $("#market-change-type-selection .right-market-btn").removeClass("btn-darkened");
        $(`#market-change-type-selection .right-market-btn#${this.marketType}`).addClass(
            "btn-darkened",
        );
        $("#market-change-rarity-selection .right-market-btn").removeClass(
            "btn-darkened",
        );
        $(
            `#market-change-rarity-selection .right-market-btn#${this.marketRarity}`,
        ).addClass("btn-darkened");
        $("#market-change-sort-selection .right-market-btn").removeClass("btn-darkened");
        $(`#market-change-sort-selection .right-market-btn#${this.marketSort}`).addClass(
            "btn-darkened",
        );
        $("#market-change-mode-selection .right-market-btn").removeClass("btn-darkened");
        $(`#market-change-mode-selection .right-market-btn#${this.marketOrder}`).addClass(
            "btn-darkened",
        );
    }

    getFilteredListings() {
        const source =
            this.activeTab === "sell" ? this.marketSellListings : this.marketBuyListings;
        const filtered = source.filter((item) => {
            if (this.marketType !== "all" && item.category !== this.marketType)
                return false;
            if (this.marketRarity !== "all" && item.rarity < Number(this.marketRarity)) {
                return false;
            }
            return true;
        });
        filtered.sort((a, b) => {
            if (this.marketSort === "item") {
                return a.name.localeCompare(b.name);
            }
            if (this.marketSort === "rarity") {
                return a.rarity - b.rarity || a.name.localeCompare(b.name);
            }
            return a.price - b.price || a.name.localeCompare(b.name);
        });
        if (this.marketOrder === "highlow") filtered.reverse();
        return filtered;
    }

    renderMarket() {
        const list = $("#market-items-list");
        list.empty();
        const items = this.getFilteredListings();
        $("#market-no-items-text").text(
            this.localization.translate(
                this.activeTab === "sell" ? "market-no-sell-items" : "market-no-items",
            ) ||
                (this.activeTab === "sell"
                    ? "You do not own any sellable items yet."
                    : "No items match the current filters."),
        );
        $("#market-no-items-available").css("display", items.length ? "none" : "block");
        items.forEach((item) => list.append(this.buildMarketItem(item)));
        this.updateMarketTimers();
    }

    buildMarketItem(item: Listing) {
        const actionLabel =
            item.action === "cancel" ? "Cancel" : item.action === "sell" ? "Sell" : "Buy";
        const sellerLabel =
            item.action === "buy"
                ? this.localization.translate("market-seller-label") || "Seller"
                : this.localization.translate("market-listing-owner-label") || "Seller";
        const sellerValue =
            item.sellerName ||
            (item.action === "buy"
                ? this.localization.translate("market-unknown-seller") || "Unknown"
                : this.localization.translate("market-you") || "You");
        const timerLabel =
            this.localization.translate("market-listed-for-label") || "Listed For";
        const card = $("<div/>", { class: "market-list-item-container" });
        const image = $("<div/>", {
            class: "market-item-img",
            css: {
                "background-image": `url(${item.image})`,
                transform: item.transform,
            },
        });
        const info = $("<div/>", { class: "market-item-info-container" }).append(
            $("<div/>", { class: "market-item-title", text: item.name }),
            $("<div/>", { class: "market-item-stats-container" }).append(
                $("<div/>", { class: "market-item-stats-text" }).append(
                    $("<span/>", { text: "Type: " }),
                    $("<p/>", {
                        text:
                            this.localization.translate(
                                categoryL10n[item.category] || "",
                            ) || item.category,
                    }),
                ),
                $("<div/>", { class: "market-item-stats-text" }).append(
                    $("<span/>", { text: " Rarity: " }),
                    $("<p/>", {
                        text:
                            this.localization.translate(rarityL10n[item.rarity] || "") ||
                            "Unknown",
                    }),
                ),
                $("<div/>", {
                    class: "market-item-stats-text market-item-meta-text",
                }).append(
                    $("<span/>", { text: `${sellerLabel}: ` }),
                    $("<p/>", { text: sellerValue }),
                ),
                $("<div/>", {
                    class: "market-item-stats-text market-item-meta-text",
                }).append(
                    $("<span/>", { text: `${timerLabel}: ` }),
                    $("<p/>", {
                        class: "market-item-timer",
                        "data-created-at": item.createdAt ? String(item.createdAt) : "",
                        text:
                            item.createdAt !== undefined
                                ? this.formatListingDuration(Date.now() - item.createdAt)
                                : this.localization.translate("market-ready-to-list") ||
                                  "Ready",
                    }),
                ),
            ),
        );
        const action = $("<div/>", { class: "market-item-action-container" });
        const button = $("<div/>", {
            class:
                item.action === "cancel"
                    ? "market-item-action-btn market-item-action-btn-cancel"
                    : "market-item-action-btn",
        }).append(
            $("<span/>", { text: actionLabel }),
            $("<div/>", { class: "market-btn-price-container" }).append(
                $("<div/>", {
                    class: "market-btn-price-text",
                    text: this.formatMarketPrice(item.price),
                }),
            ),
        );
        button.on("click", () => this.handleMarketAction(item));
        action.append(button);
        card.append(image, info, action);
        return card;
    }

    handleMarketAction(item: Listing) {
        if (item.action === "buy") {
            if (!item.id) return;
            this.account.buyMarketListing(item.id, (error) => {
                this.setStatus(
                    error ? `shop-market-error-${error}` : "shop-market-buy-success",
                );
            });
            return;
        }

        if (item.action === "cancel") {
            this.pendingAction = "cancel";
            this.pendingSellItem = item;
            $("#modal-confirm-sell-title").text(
                this.localization.translate("confirm-cancel-modal-title") ||
                    "Cancel listing",
            );
            $("#modal-confirm-sell-desc").text(
                this.localization.translate("confirm-cancel-modal-desc") ||
                    "Are you sure you want to cancel this listing?",
            );
            $("#confirm-sell-no span").text(
                this.localization.translate("confirm-cancel-modal-no") || "No",
            );
            $("#confirm-sell-yes span").text(
                this.localization.translate("confirm-cancel-modal-yes") || "Yes!",
            );
            $(".confirm-sell-price-row").hide();
            $("#confirm-sell-price-range").hide();
            $("#confirm-sell-price-error").text("").hide();
            this.confirmSellModal.show(true);
            return;
        }

        this.pendingAction = "sell";
        this.pendingSellItem = item;
        const priceBounds = getMarketPriceBounds(item.type);
        $("#modal-confirm-sell-title").text(
            this.localization.translate("confirm-sell-modal-title") || "Confirm Sell",
        );
        $("#modal-confirm-sell-desc").text(
            this.localization.translate("confirm-sell-modal-desc") ||
                "Are you sure you want to sell the selected item?",
        );
        $("#confirm-sell-no span").text(
            this.localization.translate("confirm-sell-modal-no") || "No, keep.",
        );
        $("#confirm-sell-yes span").text(
            this.localization.translate("confirm-sell-modal-yes") || "Yes, sell.",
        );
        $("#confirm-sell-price-input").val(String(priceBounds?.min ?? item.price));
        $("#confirm-sell-price-input").attr("min", String(priceBounds?.min ?? 0));
        $("#confirm-sell-price-input").attr(
            "max",
            String(priceBounds?.max ?? item.price),
        );
        $("#confirm-sell-price-range").text(this.formatPriceRangeText(item.type));
        $(".confirm-sell-price-row").show();
        $("#confirm-sell-price-range").show();
        this.updateSellPriceValidation();
        this.confirmSellModal.show(true);
        $("#confirm-sell-price-input").trigger("focus");
    }

    startMarketTimers() {
        this.stopMarketTimers();
        this.marketTimerId = window.setInterval(() => this.updateMarketTimers(), 1000);
    }

    stopMarketTimers() {
        if (this.marketTimerId !== null) {
            window.clearInterval(this.marketTimerId);
            this.marketTimerId = null;
        }
    }

    updateMarketTimers() {
        $(".market-item-timer").each((_, element) => {
            const timer = $(element);
            const createdAt = Number(timer.attr("data-created-at"));
            if (!createdAt) return;
            timer.text(this.formatListingDuration(Date.now() - createdAt));
        });
    }

    formatListingDuration(elapsedMs: number) {
        const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [hours, minutes, seconds]
            .map((value) => String(value).padStart(2, "0"))
            .join(":");
    }

    formatPriceRangeText(itemType: string) {
        const bounds = getMarketPriceBounds(itemType);
        if (!bounds) return "";

        const template =
            this.localization.translate("market-price-range") || "Min {min} | Max {max}";
        return template
            .replace("{min}", String(bounds.min))
            .replace("{max}", String(bounds.max));
    }

    formatMarketPrice(price: number) {
        if (price >= 1000) {
            return `${Math.floor(price / 1000)}k`;
        }
        return String(price);
    }

    getPendingSellPrice() {
        const item = this.pendingSellItem;
        if (!item) return null;

        const rawValue = Number($("#confirm-sell-price-input").val());
        const bounds = getMarketPriceBounds(item.type);
        if (!bounds || !Number.isInteger(rawValue)) {
            this.showSellPriceError("shop-market-error-invalid_price");
            this.setStatus("shop-market-error-invalid_price");
            return null;
        }
        if (rawValue < bounds.min) {
            this.showSellPriceError("shop-market-error-price_too_low");
            this.setStatus("shop-market-error-price_too_low");
            return null;
        }
        if (rawValue > bounds.max) {
            this.showSellPriceError("shop-market-error-price_too_high");
            this.setStatus("shop-market-error-price_too_high");
            return null;
        }

        this.showSellPriceError("");
        return rawValue;
    }

    updateSellPriceValidation() {
        const item = this.pendingSellItem;
        if (!item || this.pendingAction !== "sell") return;

        const rawValue = Number($("#confirm-sell-price-input").val());
        const bounds = getMarketPriceBounds(item.type);
        if (!bounds || !Number.isInteger(rawValue)) {
            this.showSellPriceError("shop-market-error-invalid_price");
            return;
        }
        if (rawValue < bounds.min) {
            this.showSellPriceError("shop-market-error-price_too_low");
            return;
        }
        if (rawValue > bounds.max) {
            this.showSellPriceError("shop-market-error-price_too_high");
            return;
        }

        this.showSellPriceError("");
    }

    showSellPriceError(key: string) {
        const errorEl = $("#confirm-sell-price-error");
        if (!key) {
            errorEl.text("").hide();
            return;
        }

        errorEl.text(this.localization.translate(key) || "That price is invalid.").show();
    }

    setStatus(key: string) {
        $("#shop-status").text(
            this.localization.translate(key) ||
                "This market action needs server support before it can be enabled.",
        );
    }
}
