import $ from "jquery";
import { GameObjectDefs } from "../../../shared/defs/gameObjectDefs";
import { Rarity } from "../../../shared/gameConfig";
import type { ShopLootBox } from "../../../shared/types/user";
import type { FeaturedBundleOffer } from "../../../shared/utils/featuredBundles";
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

const marketListingDurationMs = 24 * 60 * 60 * 1000;

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
    soldNotificationModal = new MenuModal($("#market-modal-notification"));
    cratesModal = new MenuModal($("#crates-modal"));
    crateContainModal = new MenuModal($("#modal-crate-contain"));
    rewardModal = new MenuModal($("#reward-modal"));
    marketErrorToast = $("#market-error-toast");
    marketTimerId: number | null = null;
    marketErrorTimeoutId: number | null = null;
    balanceAnimationId: number | null = null;
    pendingSellItem: Listing | null = null;
    pendingFeaturedBundle: FeaturedBundleOffer | null = null;
    pendingLootBox: ShopLootBox | null = null;
    pendingAction: "buy" | "sell" | "cancel" | "bundle" | "lootbox" = "sell";
    pendingSoldListings: Listing[] = [];
    pendingSoldListingIds = new Set<string>();
    soldNotificationActive = false;
    pendingExpiredItems: Listing[] = [];
    activeTab: ShopTab = "shop";
    marketType = "all";
    marketRarity = "all";
    marketSort: MarketSort = "price";
    marketOrder: MarketOrder = "lowhigh";
    marketBuyListings: Listing[] = [];
    marketSellListings: Listing[] = [];
    gpBalance = 0;
    displayedGpBalance = 0;
    pendingGpBalanceTarget: number | null = null;
    marketRefreshCooldownUntil = 0;
    marketRefreshInFlight = false;
    lootBoxRevealTimeoutId: number | null = null;
    openingLootBox = false;

    constructor(
        public account: Account,
        public localization: Localization,
    ) {
        if (!this.marketErrorToast.length) {
            this.marketErrorToast = $("<div/>", {
                id: "market-error-toast",
            }).appendTo("body");
        }
        this.bindUi();
        this.account.addEventListener("items", () => {
            this.refreshData();
            this.render();
        });
        this.account.addEventListener("market", () => {
            this.refreshData();
            this.render();
            this.updateMarketRefreshUi();
        });
        this.account.addEventListener("gpBalance", () => {
            this.renderBalance();
        });
        this.account.addEventListener("soldMarketListings", (soldListings) => {
            this.enqueueSoldListings(soldListings);
        });
        this.account.addEventListener("expiredMarketListings", (expiredItemTypes) => {
            this.enqueueExpiredItems(expiredItemTypes);
        });
        this.account.addEventListener("login", () => {
            this.refreshData();
            this.render();
            this.account.loadMarket();
            this.updateMarketRefreshUi();
        });
        this.refreshData();
        this.render();
        this.updateMarketRefreshUi();
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
            this.cratesModal.hide();
            this.crateContainModal.hide();
            $("#spin-modal").hide();
            this.rewardModal.hide();
            this.openingLootBox = false;
            if (this.lootBoxRevealTimeoutId !== null) {
                window.clearTimeout(this.lootBoxRevealTimeoutId);
                this.lootBoxRevealTimeoutId = null;
            }
        });

        this.confirmSellModal.onHide(() => {
            this.pendingSellItem = null;
            this.pendingFeaturedBundle = null;
            this.pendingLootBox = null;
            $("#confirm-sell-price-range").hide();
            $("#confirm-sell-price-error").text("").hide();
        });
        this.soldNotificationModal.onHide(() => {
            if (this.soldNotificationActive) {
                this.onSoldNotificationConfirmed();
            }
        });

        $("#start-shop-shortcut, #open-store-button").on("click", (e) => {
            e.preventDefault();
            this.modal.show(true);
            return false;
        });
        $("#shop-lootbox-button").on("click", (e) => {
            e.preventDefault();
            if (this.getOrderedLootBoxes().length === 0) return false;
            this.cratesModal.show();
            return false;
        });
        for (const [index, selectorSuffix] of ["1", "2", "3"].entries()) {
            $(`#btn-contains-crate-${selectorSuffix}`).on("click", (e) => {
                e.preventDefault();
                const lootBox = this.getOrderedLootBoxes()[index];
                if (!lootBox) return false;
                this.showLootBoxContents(lootBox);
                return false;
            });
            $(`#open-crate-${selectorSuffix}`).on("click", (e) => {
                e.preventDefault();
                const lootBox = this.getOrderedLootBoxes()[index];
                if (!lootBox) return false;
                this.handleLootBoxAction(lootBox);
                return false;
            });
        }
        $("#reward-modal-close").on("click", (e) => {
            e.preventDefault();
            this.rewardModal.hide();
            return false;
        });
        $("#reward-modal-equip").on("click", (e) => {
            e.preventDefault();
            this.rewardModal.hide();
            this.cratesModal.hide();
            this.crateContainModal.hide();
            this.modal.hide();
            $("#btn-customize").trigger("click");
            return false;
        });

        $("#confirm-sell-yes").on("click", (e) => {
            e.preventDefault();
            const item = this.pendingSellItem;
            const bundle = this.pendingFeaturedBundle;
            const action = this.pendingAction;
            if (action === "bundle") {
                if (!bundle) return false;
                this.confirmSellModal.hide();
                this.account.buyFeaturedBundle(bundle.id, (error) => {
                    if (error) {
                        this.showMarketError(error);
                    }
                });
                return false;
            }
            if (action === "lootbox") {
                const lootBox = this.pendingLootBox;
                if (!lootBox || this.openingLootBox) return false;
                this.openingLootBox = true;
                this.confirmSellModal.hide();
                this.cratesModal.hide();
                this.crateContainModal.hide();
                this.account.openLootBox(lootBox.id, (error, reward) => {
                    this.openingLootBox = false;
                    if (error) {
                        this.showMarketError(error);
                        return;
                    }
                    const itemType = reward?.itemType;
                    if (!itemType) {
                        this.showMarketError("server_error");
                        return;
                    }
                    this.startLootBoxSpin(lootBox, itemType);
                });
                return false;
            }
            if (!item) return false;
            if (action === "buy") {
                this.confirmSellModal.hide();
                if (!item.id) return false;
                this.account.buyMarketListing(item.id, (error) => {
                    if (error) {
                        this.showMarketError(error);
                    } else {
                        this.setStatus("shop-market-buy-success");
                    }
                });
                return false;
            }
            if (action === "cancel") {
                this.confirmSellModal.hide();
                if (!item.id) return false;
                this.account.cancelMarketListing(item.id, (error) => {
                    if (error) {
                        this.showMarketError(error);
                    } else {
                        this.setStatus("shop-market-cancel-success");
                    }
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
                if (error) {
                    this.showMarketError(error);
                } else {
                    this.setStatus("shop-market-sell-success");
                }
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
        $("#market-btn-search-items").on("click", () => this.refreshMarket());

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
        $("#lock-shop-container").css(
            "display",
            this.account.loggedIn ? "none" : "block",
        );
        $(".market-btns-container").toggleClass(
            "market-ui-locked",
            !this.account.loggedIn,
        );
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
                if (rarity < Rarity.Common) return null;
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
        this.renderLootBoxes();
        this.renderBalance();
        this.syncFilterLabels();
        this.setTab(this.activeTab);
    }

    renderBalance() {
        this.gpBalance = this.account.gpBalance;
        if (this.pendingSoldListings.length > 0) {
            this.pendingGpBalanceTarget = this.gpBalance;
            return;
        }
        this.setDisplayedGpBalance(this.gpBalance);
    }

    renderFeatured() {
        const bundles = this.account.featuredBundles || [];
        const nextRefreshAt = bundles.reduce(
            (max, bundle) => Math.max(max, bundle.refreshesAt || 0),
            0,
        );
        $("#iap-lto-time-left-number").text(
            nextRefreshAt > 0
                ? this.formatBundleCountdown(nextRefreshAt - Date.now())
                : "00:00:00",
        );
        $("#index-offer-time-left").text(
            nextRefreshAt > 0
                ? ` ${this.formatBundleCountdown(nextRefreshAt - Date.now())}`
                : " 00:00:00",
        );

        const packMappings: Array<[string, FeaturedBundleOffer | undefined]> = [
            ["#iap-lto-pack-1", bundles.find((bundle) => bundle.size === "small")],
            ["#iap-lto-pack-2", bundles.find((bundle) => bundle.size === "large")],
        ];

        for (const [selector, bundle] of packMappings) {
            const pack = $(selector);
            const itemsContainer = pack.find(".iap-loadout-items");
            itemsContainer.empty();

            if (!bundle) {
                pack.off("click").addClass("market-refresh-disabled");
                pack.removeClass("iap-pack-purchased");
                pack.find(".iap-currency-text").text("0");
                pack.find(".iap-discount").text("--");
                continue;
            }

            pack.toggleClass("iap-pack-purchased", bundle.purchased);
            pack.find(".iap-currency-text").text(String(bundle.price));
            pack.find(".iap-discount").text(`${bundle.discountPercent}% OFF`);
            const itemRow = $("<div/>");

            for (const itemType of bundle.itemTypes) {
                itemRow.append(this.buildFeaturedBundleItem(itemType));
            }
            itemsContainer.append(itemRow);

            if (bundle.purchased) {
                pack.off("click").addClass("market-refresh-disabled");
                continue;
            }

            pack.removeClass("market-refresh-disabled");
            pack.off("click").on("click", () => this.handleFeaturedAction(bundle));
        }
    }

    renderLootBoxes() {
        const lootBoxes = this.getOrderedLootBoxes();
        const shopButton = $("#shop-lootbox-button");
        const crateTitle = $("#modal-crate-contain-title");

        if (lootBoxes.length === 0) {
            shopButton.addClass("market-refresh-disabled");
            for (const selectorSuffix of ["1", "2", "3"]) {
                $(`#open-crate-${selectorSuffix}`).addClass("disable");
                $(`#crate-price-${selectorSuffix}`).text("0");
            }
            crateTitle.text(
                this.localization.translate("shop-lootbox-unavailable") || "Unavailable",
            );
            return;
        }

        shopButton.removeClass("market-refresh-disabled");
        crateTitle.text(lootBoxes[0]!.name);
        for (const [index, selectorSuffix] of ["1", "2", "3"].entries()) {
            const lootBox = lootBoxes[index];
            if (!lootBox) {
                $(`#open-crate-${selectorSuffix}`).addClass("disable");
                $(`#crate-price-${selectorSuffix}`).text("0");
                continue;
            }
            $(`#open-crate-${selectorSuffix}`).removeClass("disable");
            $(`#crate-price-${selectorSuffix}`).text(String(lootBox.price));
        }
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

    refreshMarket() {
        if (this.marketRefreshInFlight) return;
        if (Date.now() < this.marketRefreshCooldownUntil) return;

        this.marketRefreshInFlight = true;
        this.marketRefreshCooldownUntil = Date.now() + 3000;
        this.updateMarketRefreshUi();
        this.account.loadMarket((success) => {
            this.marketRefreshInFlight = false;
            this.updateMarketRefreshUi();
            if (!success) {
                this.setStatus("shop-market-load-failed");
            }
        });
    }

    buildMarketItem(item: Listing) {
        const actionLabel =
            item.action === "cancel"
                ? this.localization.translate("confirm-cancel-modal-title") ||
                  "Cancel listing"
                : item.action === "sell"
                  ? this.localization.translate("market-sell-item-action") || "Sell item"
                  : "Buy";
        const sellerLabel =
            item.action === "buy"
                ? this.localization.translate("market-seller-label") || "Seller"
                : this.localization.translate("market-sort-makr") ||
                  this.localization.translate("market-listing-owner-label") ||
                  "Seller";
        const sellerValue =
            item.sellerName ||
            (item.action === "buy"
                ? this.localization.translate("market-unknown-seller") || "Unknown"
                : this.localization.translate("market-you") || "You");
        const isSellPageCard = item.action !== "buy";
        const isActiveListing = item.action === "cancel";
        const expiresAt = item.createdAt
            ? item.createdAt + marketListingDurationMs
            : undefined;
        const rarityVisuals = helpers.getRarityVisuals(item.rarity);
        const card = $("<div/>", {
            class: [
                "market-list-item-container",
                isSellPageCard ? "market-list-item-sell" : "market-list-item-buy",
                isActiveListing ? "market-list-item-active" : "",
            ]
                .filter(Boolean)
                .join(" "),
        });
        const image = $("<div/>", {
            class: "market-item-img",
            css: {
                "background-color": rarityVisuals.backgroundColor,
                border: `2px solid ${rarityVisuals.border}`,
                "border-radius": "0",
                "box-shadow": "inset 0 0 0 1px rgba(0,0,0,0.35)",
            },
        });
        image.append(
            $("<div/>", {
                class: "market-item-sprite",
                css: {
                    "background-image": `url(${item.image})`,
                    transform: item.transform,
                },
            }),
        );
        image.append(helpers.getItemRarityStyleMarkup(item.type, item.rarity));
        const info = $("<div/>", {
            class: [
                "market-item-info-container",
                isSellPageCard ? "market-item-info-sell" : "",
            ]
                .filter(Boolean)
                .join(" "),
        }).append($("<div/>", { class: "market-item-title", text: item.name }));

        if (isSellPageCard) {
            info.append(
                $("<div/>", { class: "market-item-stats-container" }).append(
                    $("<div/>", { class: "market-item-stats-text" }).append(
                        $("<span/>", { text: `${sellerLabel}: ` }),
                        $("<p/>", { text: sellerValue }),
                    ),
                    $("<div/>", { class: "market-stats-second-line-container" }).append(
                        $("<div/>", { class: "market-item-stats-text" }).append(
                            $("<span/>", {
                                text: `${this.localization.translate("market-type-label") || "Type"}: `,
                            }),
                            $("<p/>", {
                                text:
                                    this.localization.translate(
                                        categoryL10n[item.category] || "",
                                    ) || item.category,
                            }),
                        ),
                        $("<div/>", { class: "market-item-stats-text" }).append(
                            $("<span/>", {
                                text: `${this.localization.translate("market-rarity") || "Rarity"}: `,
                            }),
                            $("<p/>", {
                                text:
                                    this.localization.translate(
                                        rarityL10n[item.rarity] || "",
                                    ) || "Unknown",
                                css: {
                                    color: rarityVisuals.text,
                                },
                            }),
                        ),
                        $("<div/>", { class: "market-item-stats-text" }).append(
                            $("<span/>", { text: "GP: " }),
                            $("<p/>", { text: this.formatMarketPrice(item.price) }),
                        ),
                    ),
                ),
            );
        } else {
            info.append(
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
                                this.localization.translate(
                                    rarityL10n[item.rarity] || "",
                                ) || "Unknown",
                            css: {
                                color: rarityVisuals.text,
                            },
                        }),
                    ),
                    $("<div/>", {
                        class: "market-item-stats-text market-item-meta-text",
                    }).append(
                        $("<span/>", { text: `${sellerLabel}: ` }),
                        $("<p/>", { text: sellerValue }),
                    ),
                ),
            );
        }
        const action = $("<div/>", { class: "market-item-action-container" });
        if (isActiveListing) {
            action.addClass("market-item-action-container-active");
            action.append(
                $("<div/>", { class: "market-item-action-timer" }).append(
                    $("<span/>", {
                        class: "market-item-action-timer-label",
                        text:
                            this.localization.translate("market-timer-expires-in") ||
                            "EXPIRES IN",
                    }),
                    $("<span/>", {
                        class: "market-item-timer market-bold-text",
                        "data-expire-at": expiresAt ? String(expiresAt) : "",
                        "data-timer-kind": "expires",
                        text: expiresAt
                            ? this.formatCountdown(expiresAt - Date.now())
                            : this.localization.translate("market-timer-expired") ||
                              "EXPIRED",
                    }),
                ),
                $("<div/>", {
                    class: "market-item-action-state",
                    text:
                        this.localization.translate("market-sale-in-progress") ||
                        "SALE IN PROGRESS",
                }),
            );
        } else {
            if (item.action === "buy") {
                action.addClass("market-item-action-container-active");
                action.append(
                    $("<div/>", { class: "market-item-action-timer" }).append(
                        $("<span/>", {
                            class: "market-item-action-timer-label",
                            text:
                                this.localization.translate("market-timer-expires-in") ||
                                "EXPIRES IN",
                        }),
                        $("<span/>", {
                            class: "market-item-timer market-bold-text",
                            "data-expire-at": expiresAt ? String(expiresAt) : "",
                            "data-timer-kind": "expires",
                            text: expiresAt
                                ? this.formatCountdown(expiresAt - Date.now())
                                : this.localization.translate("market-timer-expired") ||
                                  "EXPIRED",
                        }),
                    ),
                );
            }
            const button = $("<div/>", {
                class:
                    item.action === "buy"
                        ? "market-item-action-btn market-item-action-btn-buy"
                        : "market-item-action-btn market-item-action-btn-sell",
            }).append($("<span/>", { text: actionLabel }));
            if (item.action === "buy") {
                button.append(
                    $("<div/>", { class: "market-btn-price-container" }).append(
                        $("<div/>", {
                            class: "market-btn-price-text",
                            text: this.formatMarketPrice(item.price),
                        }),
                    ),
                );
            }
            button.on("click", () => this.handleMarketAction(item));
            action.append(button);
        }
        card.append(image, info, action);
        return card;
    }

    handleMarketAction(item: Listing) {
        if (item.action === "buy") {
            this.pendingAction = "buy";
            this.pendingSellItem = item;
            $("#modal-confirm-sell-title").text(
                this.localization.translate("confirm-buy-modal-title") || "Confirm Buy",
            );
            $("#modal-confirm-sell-desc").text(
                this.localization.translate("confirm-buy-modal-desc") ||
                    "Are you sure you want to buy this item?",
            );
            $("#confirm-sell-no span").text(
                this.localization.translate("confirm-buy-modal-no") || "No, cancel.",
            );
            $("#confirm-sell-yes span").text(
                this.localization.translate("confirm-buy-modal-yes") || "Yes, buy.",
            );
            $(".confirm-sell-price-row").hide();
            $("#confirm-sell-price-range").hide();
            $("#confirm-sell-price-error").text("").hide();
            this.confirmSellModal.show(true);
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

    handleFeaturedAction(bundle: FeaturedBundleOffer) {
        this.pendingAction = "bundle";
        this.pendingFeaturedBundle = bundle;
        this.pendingSellItem = null;
        $("#modal-confirm-sell-title").text(
            this.localization.translate("shop-featured-bundle-confirm-title") ||
                "Buy bundle",
        );
        $("#modal-confirm-sell-desc").text(
            this.localization.translate("shop-featured-bundle-confirm-desc") ||
                "Spend GP to unlock every item in this bundle?",
        );
        $("#confirm-sell-no span").text(
            this.localization.translate("confirm-buy-modal-no") || "No, cancel.",
        );
        $("#confirm-sell-yes span").text(
            this.localization.translate("shop-featured-bundle-confirm-yes") ||
                "Yes, buy it.",
        );
        $(".confirm-sell-price-row").hide();
        $("#confirm-sell-price-range").hide();
        $("#confirm-sell-price-error").text("").hide();
        this.confirmSellModal.show(true);
    }

    handleLootBoxAction(lootBox: ShopLootBox) {
        this.pendingAction = "lootbox";
        this.pendingLootBox = lootBox;
        this.pendingSellItem = null;
        this.pendingFeaturedBundle = null;
        $("#modal-confirm-sell-title").text(
            this.localization.translate("shop-lootbox-confirm-title") || "Open loot box",
        );
        $("#modal-confirm-sell-desc").text(
            (
                this.localization.translate("shop-lootbox-confirm-desc") ||
                "Spend {gp} GP to open this loot box?"
            ).replace("{gp}", String(lootBox.price)),
        );
        $("#confirm-sell-no span").text(
            this.localization.translate("confirm-buy-modal-no") || "No, cancel.",
        );
        $("#confirm-sell-yes span").text(
            this.localization.translate("shop-lootbox-open") || "Open Loot Box",
        );
        $(".confirm-sell-price-row").hide();
        $("#confirm-sell-price-range").hide();
        $("#confirm-sell-price-error").text("").hide();
        this.confirmSellModal.show(true);
    }

    showLootBoxContents(lootBox: ShopLootBox) {
        const modalContent = $("#modal-crate-contain > .modal-content");
        const odds = $("#modal-crate-odds");
        const items = $("#modal-crate-items");
        const bodyText = $("#modal-crate-contain .modal-body-text");
        modalContent.removeClass("crate-theme-green crate-theme-blue crate-theme-red");
        modalContent.addClass(
            lootBox.id === "loot_box_02"
                ? "crate-theme-blue"
                : lootBox.id === "loot_box_03"
                  ? "crate-theme-red"
                  : "crate-theme-green",
        );
        $("#modal-crate-contain-title").text(lootBox.name);
        bodyText.text(`Open a ${lootBox.name} for a chance at classic Surviv cosmetics.`);
        odds.empty();
        items.empty();
        for (const rarity of [
            Rarity.Common,
            Rarity.Uncommon,
            Rarity.Rare,
            Rarity.Epic,
            Rarity.Mythic,
        ]) {
            const weight =
                lootBox.chances.find((chance) => chance.rarity === rarity)?.weight ?? 0;
            const rarityKey = rarityL10n[rarity] || "loadout-common";
            const label =
                this.localization.translate(rarityKey) || this.getRarityLabel(rarity);
            odds.append(
                $("<div/>", {
                    class: "shop-lootbox-odds-item",
                    text: `${label} ${weight}%`,
                }),
            );
        }
        for (const itemType of lootBox.itemTypes) {
            items.append(
                this.buildFeaturedBundleItem(itemType).addClass("shop-lootbox-item"),
            );
        }
        this.crateContainModal.show(true);
    }

    showLootBoxOpening() {
        const strip = $("#modal-lootbox-roulette-strip");
        strip.empty();
        strip.css({
            transition: "none",
            transform: "translateX(0px)",
        });
        $("#spin-modal").show();
    }

    startLootBoxSpin(lootBox: ShopLootBox, rewardItemType: string) {
        this.showLootBoxOpening();
        const strip = $("#modal-lootbox-roulette-strip");
        const rouletteContainer = $(".roulette_container");
        const pool = lootBox.itemTypes.length > 0 ? lootBox.itemTypes : [rewardItemType];
        const totalItems = 60;
        const winningIndex = 56;

        for (let i = 0; i < totalItems; i++) {
            const itemType =
                i === winningIndex
                    ? rewardItemType
                    : pool[Math.floor(Math.random() * pool.length)] || rewardItemType;
            strip.append(this.buildRouletteItem(itemType));
        }

        window.setTimeout(() => {
            const containerWidth = rouletteContainer.width() || 760;
            const winningItem = strip.children().eq(winningIndex) as JQuery<HTMLElement>;
            const itemStep = winningItem.outerWidth(true) || 128;
            const itemLeft = winningItem.position()?.left ?? winningIndex * itemStep;
            const targetCenter = itemLeft + itemStep / 2;
            const translateX = containerWidth / 2 - targetCenter;
            strip.css({
                transition: "transform 4.2s cubic-bezier(0.12, 0.8, 0.18, 1)",
                transform: `translateX(${translateX}px)`,
            });
        }, 30);

        if (this.lootBoxRevealTimeoutId !== null) {
            window.clearTimeout(this.lootBoxRevealTimeoutId);
        }
        this.lootBoxRevealTimeoutId = window.setTimeout(() => {
            this.revealLootBoxReward(rewardItemType);
            this.lootBoxRevealTimeoutId = null;
        }, 4600);
    }

    revealLootBoxReward(itemType: string) {
        const def = GameObjectDefs[itemType] as any;
        const rarity = def?.rarity ?? Rarity.Stock;
        const rarityVisuals = helpers.getRarityVisuals(rarity);
        $("#spin-modal").hide();
        $("#reward-item-name").text(
            this.localization.translate(`game-${itemType}`) || def?.name || itemType,
        );
        $("#reward-modal .reward-title").text(
            this.localization.translate("shop-lootbox-reveal-title") || "YOU GOT",
        );
        const rewardImage = $("<div/>", {
            css: {
                border: `4px solid ${rarityVisuals.border}`,
                "background-color": rarityVisuals.backgroundColor,
            },
        });
        rewardImage.append(
            $("<div/>", {
                class: "lootbox-reward-sprite",
                css: {
                    "background-image": `url(${helpers.getSvgFromGameType(itemType)})`,
                    transform: helpers.getCssTransformFromGameType(itemType),
                },
            }),
        );
        rewardImage.append(helpers.getItemRarityStyleMarkup(itemType, rarity));
        $("#reward-item-image").empty().append(rewardImage);
        this.rewardModal.show(true);
    }

    buildRouletteItem(itemType: string) {
        const def = GameObjectDefs[itemType] as any;
        const rarity = def?.rarity ?? Rarity.Stock;
        const rarityVisuals = helpers.getRarityVisuals(rarity);
        return $("<div/>", {
            class: "lootbox-roulette-item",
            css: {
                outline: `solid 4px ${rarityVisuals.border}`,
                background: rarityVisuals.backgroundColor,
            },
        }).append(
            $("<div/>", {
                class: "lootbox-roulette-sprite",
                css: {
                    "background-image": `url(${helpers.getSvgFromGameType(itemType)})`,
                    transform: helpers.getCssTransformFromGameType(itemType),
                },
            }),
        );
    }

    buildFeaturedBundleItem(itemType: string) {
        const def = GameObjectDefs[itemType] as any;
        const rarity = def?.rarity ?? Rarity.Stock;
        const rarityVisuals = helpers.getRarityVisuals(rarity);
        const label =
            this.localization.translate(`game-${itemType}`) || def?.name || itemType;
        const image = $("<div/>", {
            class: "iap-item-img",
            title: label,
            css: {
                "background-color": rarityVisuals.backgroundColor,
                border: `2px solid ${rarityVisuals.border}`,
            },
        });
        image.append(
            $("<div/>", {
                class: "iap-item-sprite",
                css: {
                    "background-image": `url(${helpers.getSvgFromGameType(itemType)})`,
                    transform: helpers.getCssTransformFromGameType(itemType),
                },
            }),
        );
        image.append(helpers.getItemRarityStyleMarkup(itemType, rarity));
        return image;
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
        this.renderFeatured();
        $(".market-item-timer").each((_, element) => {
            const timer = $(element);
            const timerKind = timer.attr("data-timer-kind");
            if (timerKind === "expires") {
                const expireAt = Number(timer.attr("data-expire-at"));
                if (!expireAt) return;
                timer.text(
                    expireAt > Date.now()
                        ? this.formatCountdown(expireAt - Date.now())
                        : this.localization.translate("market-timer-expired") ||
                              "EXPIRED",
                );
                return;
            }
            const createdAt = Number(timer.attr("data-created-at"));
            if (!createdAt) return;
            timer.text(this.formatListingDuration(Date.now() - createdAt));
        });
        this.updateMarketRefreshUi();
    }

    updateMarketRefreshUi() {
        const button = $("#market-btn-search-items");
        const cooldownText = $("#market-search-cooldown-timer");
        const cooldownContainer = $(".market-cooldown-timer-text");
        const remainingMs = Math.max(0, this.marketRefreshCooldownUntil - Date.now());
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        const buttonLabel = this.localization.translate("market-refresh") || "Refresh";
        const loadingLabel =
            this.localization.translate("market-refreshing") || "Refreshing...";
        const isCoolingDown = remainingSeconds > 0;

        button.text(this.marketRefreshInFlight ? loadingLabel : buttonLabel);
        button.toggleClass(
            "market-refresh-disabled",
            this.marketRefreshInFlight || isCoolingDown,
        );
        cooldownText.text(isCoolingDown ? `${remainingSeconds}s` : "");
        cooldownContainer.css("display", isCoolingDown ? "block" : "none");
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

    formatBundleCountdown(remainingMs: number) {
        const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [hours, minutes, seconds]
            .map((value) => String(value).padStart(2, "0"))
            .join(":");
    }

    formatCountdown(remainingMs: number) {
        const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
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

    getRarityLabel(rarity: number) {
        return (
            this.localization.translate(rarityL10n[rarity] || "") ||
            {
                [Rarity.Common]: "Common",
                [Rarity.Uncommon]: "Uncommon",
                [Rarity.Rare]: "Rare",
                [Rarity.Epic]: "Epic",
                [Rarity.Mythic]: "Mythic",
            }[rarity] ||
            "Unknown"
        );
    }

    getOrderedLootBoxes() {
        return [...(this.account.lootBoxes || [])].sort((a, b) => a.price - b.price);
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

    showMarketError(error: string) {
        const message =
            this.localization.translate(`shop-market-error-${error}`) ||
            this.localization.translate("shop-market-error-server_error") ||
            "Market error.";

        if (this.marketErrorTimeoutId !== null) {
            window.clearTimeout(this.marketErrorTimeoutId);
            this.marketErrorTimeoutId = null;
        }

        this.marketErrorToast
            .stop(true, true)
            .removeClass("market-error-toast-visible")
            .text(message)
            .css({
                display: "block",
                opacity: 1,
            })
            .addClass("market-error-toast-visible");

        this.marketErrorTimeoutId = window.setTimeout(() => {
            this.marketErrorToast.stop(true, true).animate(
                {
                    opacity: 0,
                },
                150,
                () => {
                    this.marketErrorToast
                        .removeClass("market-error-toast-visible")
                        .css({
                            display: "none",
                        })
                        .text("");
                },
            );
            this.marketErrorTimeoutId = null;
        }, 1800);
    }

    setStatus(key: string) {
        void key;
    }

    enqueueSoldListings(
        soldListings: Array<{
            id: string;
            itemType: string;
            price: number;
        }>,
    ) {
        let added = false;
        for (const sold of soldListings) {
            if (this.pendingSoldListingIds.has(sold.id)) {
                continue;
            }
            const def = GameObjectDefs[sold.itemType] as any;
            if (!def) {
                continue;
            }
            this.pendingSoldListingIds.add(sold.id);
            this.pendingSoldListings.push({
                id: sold.id,
                itemId: sold.id,
                type: sold.itemType,
                category: def.type,
                name:
                    this.localization.translate(`game-${sold.itemType}`) ||
                    def.name ||
                    sold.itemType,
                rarity: def.rarity ?? Rarity.Stock,
                image: helpers.getSvgFromGameType(sold.itemType),
                transform: helpers.getCssTransformFromGameType(sold.itemType),
                price: sold.price,
                action: "buy",
            });
            added = true;
        }

        if (!added) {
            return;
        }

        this.pendingGpBalanceTarget = this.gpBalance;
        this.showNextSoldNotification();
    }

    showNextSoldNotification() {
        if (
            this.soldNotificationActive ||
            (this.pendingSoldListings.length === 0 &&
                this.pendingExpiredItems.length === 0)
        ) {
            return;
        }

        const sold = this.pendingSoldListings[0];
        const expired = !sold ? this.pendingExpiredItems[0]! : null;
        const item = sold || expired!;
        const modal = $("#market-modal-notification");
        modal
            .find("#market-modal-notification-title-text")
            .text(
                sold
                    ? this.localization.translate("market-item-sold-title") || "Item Sold"
                    : this.localization.translate("market-item-expired-title") ||
                          "Item Expired",
            );
        modal
            .find("#market-modal-notification-text")
            .text(
                sold
                    ? this.localization.translate("market-item-sold-desc") ||
                          "Your item has been sold."
                    : this.localization.translate("market-item-expired-desc") ||
                          "Your market listing expired.",
            );
        modal.find("#market-item-sell-img").css({
            "background-color": helpers.getRarityVisuals(item.rarity).backgroundColor,
            border: `2px solid ${helpers.getRarityVisuals(item.rarity).border}`,
            "border-radius": "0",
            "box-shadow": "inset 0 0 0 1px rgba(0,0,0,0.35)",
        });
        modal.find("#market-item-sell-img .market-item-sprite").remove();
        modal.find("#market-item-sell-img").prepend(
            $("<div/>", {
                class: "market-item-sprite",
                css: {
                    "background-image": `url(${item.image})`,
                    transform: item.transform,
                },
            }),
        );
        const rarityBadge = $(helpers.getItemRarityStyleMarkup(item.type, item.rarity));
        modal
            .find("#market-item-sell-type")
            .attr("style", rarityBadge.attr("style") || "")
            .html(rarityBadge.html() || "");
        modal.find("#market-item-name").text(item.name);
        $("#market-modal-price-element").css("display", sold ? "flex" : "none");
        if (sold) {
            modal.find("#market-buy-price").text(String(sold.price));
        }
        modal
            .find("#market-modal-notification-btn-text")
            .text(this.localization.translate("index-confirm") || "Great!");
        this.soldNotificationActive = true;
        this.soldNotificationModal.show(true);
    }

    onSoldNotificationConfirmed() {
        const sold = this.pendingSoldListings.shift();
        this.soldNotificationActive = false;
        if (!sold?.id) {
            if (this.pendingExpiredItems.length > 0) {
                this.pendingExpiredItems.shift();
                this.showNextSoldNotification();
            }
            return;
        }

        this.account.ackSoldMarketListings([sold.id], () => {});
        this.pendingSoldListingIds.delete(sold.id);

        if (this.pendingSoldListings.length === 0) {
            const target = this.pendingGpBalanceTarget ?? this.gpBalance;
            this.pendingGpBalanceTarget = null;
            this.animateDisplayedGpBalance(target);
        } else {
            this.showNextSoldNotification();
        }
    }

    enqueueExpiredItems(expiredItemTypes: string[]) {
        for (const itemType of expiredItemTypes) {
            const def = GameObjectDefs[itemType] as any;
            if (!def) {
                continue;
            }
            this.pendingExpiredItems.push({
                type: itemType,
                category: def.type,
                name:
                    this.localization.translate(`game-${itemType}`) ||
                    def.name ||
                    itemType,
                rarity: def.rarity ?? Rarity.Stock,
                image: helpers.getSvgFromGameType(itemType),
                transform: helpers.getCssTransformFromGameType(itemType),
                price: 0,
                action: "buy",
            });
        }
        this.showNextSoldNotification();
    }

    animateDisplayedGpBalance(targetBalance: number) {
        if (this.balanceAnimationId !== null) {
            window.cancelAnimationFrame(this.balanceAnimationId);
            this.balanceAnimationId = null;
        }

        const startBalance = this.displayedGpBalance;
        const delta = targetBalance - startBalance;
        if (delta === 0) {
            this.setDisplayedGpBalance(targetBalance);
            return;
        }

        const startTime = performance.now();
        const duration = Math.min(900, Math.max(300, Math.abs(delta) * 2));
        const step = (now: number) => {
            const progress = Math.min(1, (now - startTime) / duration);
            const eased = 1 - (1 - progress) * (1 - progress);
            const current = Math.round(startBalance + delta * eased);
            this.setDisplayedGpBalance(current);
            if (progress < 1) {
                this.balanceAnimationId = window.requestAnimationFrame(step);
            } else {
                this.balanceAnimationId = null;
                this.setDisplayedGpBalance(targetBalance);
            }
        };

        this.balanceAnimationId = window.requestAnimationFrame(step);
    }

    setDisplayedGpBalance(value: number) {
        this.displayedGpBalance = value;
        $("#shop-gp-balance").text(String(value));
        $("#start-gp-display-amount").text(String(value));
    }
}
