import $ from "jquery";
import { GameObjectDefs } from "../../../shared/defs/gameObjectDefs";
import { Rarity } from "../../../shared/gameConfig";
import type { Account } from "../account";
import { helpers } from "../helpers";
import { MenuModal } from "./menuModal";
import type { Localization } from "./localization";

type ShopTab = "shop" | "buy" | "sell";
type MarketSort = "price" | "item" | "rarity";
type MarketOrder = "lowhigh" | "highlow";

type Listing = {
    type: string;
    category: string;
    name: string;
    rarity: number;
    image: string;
    transform: string;
    price: number;
    owned?: boolean;
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

function hashString(value: string) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
}

export class ShopMenu {
    modal = new MenuModal($("#iap-modal"));
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
        });

        $("#btn-gp-shop, .account-shop-link").on("click", (e) => {
            e.preventDefault();
            this.modal.show(true);
            return false;
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
            if ($(e.target).closest(`${triggerSelector}, ${panelSelector}`).length === 0) {
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
        $("#tab-shop, #tab-market-buy, #tab-market-sell").removeClass("store-tab-selected");
        $(`#tab-${tab === "buy" ? "market-buy" : tab === "sell" ? "market-sell" : "shop"}`).addClass(
            "store-tab-selected",
        );

        const shopVisible = tab === "shop";
        $(".iap-container").css("display", shopVisible ? "flex" : "none");
        $(".market-container").css("display", shopVisible ? "none" : "flex");
        $(".market-locked-container").css("display", "none");
        if (!shopVisible) {
            this.renderMarket();
        }
    }

    buildMarketBuyListings() {
        const listings: Listing[] = [];
        for (const [type, def] of Object.entries(GameObjectDefs)) {
            const defType = (def as any).type;
            if (!supportedMarketTypes.has(defType)) continue;
            const rarity = (def as any).rarity ?? Rarity.Stock;
            if (rarity < Rarity.Rare) continue;
            listings.push({
                type,
                category: defType,
                name: this.localization.translate(`game-${type}`) || (def as any).name || type,
                rarity,
                image: helpers.getSvgFromGameType(type),
                transform: helpers.getCssTransformFromGameType(type),
                price: 150 + rarity * 125 + (hashString(type) % 125),
                owned: this.account.items.some((item) => item.type === type),
            });
        }
        return listings.sort((a, b) => a.price - b.price).slice(0, 180);
    }

    buildMarketSellListings() {
        return this.account.items
            .map((item) => {
                const def = GameObjectDefs[item.type] as any;
                if (!def || !supportedMarketTypes.has(def.type)) return null;
                const rarity = def.rarity ?? Rarity.Stock;
                if (rarity < Rarity.Rare) return null;
                return {
                    type: item.type,
                    category: def.type,
                    name:
                        this.localization.translate(`game-${item.type}`) ||
                        def.name ||
                        item.type,
                    rarity,
                    image: helpers.getSvgFromGameType(item.type),
                    transform: helpers.getCssTransformFromGameType(item.type),
                    price: 100 + rarity * 100 + (hashString(item.type) % 90),
                    owned: true,
                } as Listing;
            })
            .filter((item): item is Listing => item !== null)
            .sort((a, b) => b.price - a.price);
    }

    render() {
        this.renderFeatured();
        this.renderBalance();
        this.syncFilterLabels();
        this.setTab(this.activeTab);
    }

    renderBalance() {
        $("#shop-gp-balance").text(String(this.gpBalance));
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
            this.marketOrder === "highlow" ? "market-mode-highlow" : "market-mode-lowhigh";

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
        $("#market-type-selected").toggleClass("right-market-btn-img", this.marketType !== "all");
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
        $("#market-change-rarity-selection .right-market-btn").removeClass("btn-darkened");
        $(`#market-change-rarity-selection .right-market-btn#${this.marketRarity}`).addClass(
            "btn-darkened",
        );
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
            if (this.marketType !== "all" && item.category !== this.marketType) return false;
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
    }

    buildMarketItem(item: Listing) {
        const actionLabel = this.activeTab === "sell" ? "Sell" : "Buy";
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
                            this.localization.translate(categoryL10n[item.category] || "") ||
                            item.category,
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
            ),
        );
        const action = $("<div/>", { class: "market-item-action-container" });
        const button = $("<div/>", { class: "market-item-action-btn" }).append(
            $("<span/>", { text: actionLabel }),
            $("<div/>", { class: "market-btn-price-container" }).append(
                $("<div/>", { class: "market-btn-price-text", text: String(item.price) }),
            ),
        );
        button.on("click", () => this.setStatus("shop-market-action-disabled"));
        action.append(button);
        card.append(image, info, action);
        return card;
    }

    setStatus(key: string) {
        $("#shop-status").text(
            this.localization.translate(key) ||
                "This market action needs server support before it can be enabled.",
        );
    }
}
