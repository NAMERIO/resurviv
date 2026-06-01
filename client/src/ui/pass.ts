import $ from "jquery";
import { GameObjectDefs } from "../../../shared/defs/gameObjectDefs";
import type { EmoteDef } from "../../../shared/defs/gameObjects/emoteDefs";
import {
    CurrentPassType,
    PassDefs,
    type PassRewardDef,
} from "../../../shared/defs/gameObjects/passDefs";
import { QuestDefs } from "../../../shared/defs/gameObjects/questDefs";
import { math } from "../../../shared/utils/math";
import { passUtil } from "../../../shared/utils/passUtil";
import type { Account } from "../account";
import { googleH5Ads } from "../ads/googleH5Ads";
import { helpers } from "../helpers";
import type { LoadoutMenu } from "./loadoutMenu";
import type { Localization } from "./localization";
import { MenuModal } from "./menuModal";

const premiumPassUnlockType = "premiumPass";
const defaultPremiumPassPrice = 1500;
const defaultUnlockAllPassPrice = 3000;

function getNextPassUnlockItemId(passType: string, currentLevel: number) {
    const passDef = PassDefs[passType];
    for (let itemIndex = 0; itemIndex < passDef.items.length; itemIndex++) {
        const reward = passDef.items[itemIndex];
        if (reward.level == currentLevel + 1) {
            return reward;
        }
    }
    return null;
}

function getPassRewardName(reward: PassRewardDef) {
    if ("item" in reward) {
        const itemDef = GameObjectDefs[reward.item];
        return (itemDef as any)?.name || reward.item;
    }
    return `${reward.gp} GP`;
}

function getPassRewardImage(reward: PassRewardDef) {
    return "item" in reward
        ? helpers.getSvgFromGameType(reward.item)
        : "img/loot/loot-golde-potato.svg";
}

function getPassRewardTransform(reward: PassRewardDef) {
    return "item" in reward ? helpers.getCssTransformFromGameType(reward.item) : "";
}

function getPassRewardItemId(reward: PassRewardDef) {
    return "item" in reward ? reward.item : null;
}

function getPassRewardRarity(reward: PassRewardDef) {
    const itemId = getPassRewardItemId(reward);
    if (!itemId) return undefined;
    return (GameObjectDefs[itemId] as { rarity?: number } | undefined)?.rarity;
}

function applyPassRewardRarityStyle(tile: JQuery<HTMLElement>, reward: PassRewardDef) {
    const itemId = getPassRewardItemId(reward);
    if (!itemId) return;

    const rarity = getPassRewardRarity(reward);
    const visuals = helpers.getRarityVisuals(rarity);
    tile.addClass("pass-rarity-item").css({
        "background-color": visuals.backgroundColor,
        border: `3px solid ${visuals.border}`,
        "--item-rarity-color": visuals.border,
    });
    tile.append(helpers.getItemRarityStyleMarkup(itemId, rarity));
}

function formatPassName(passName: string) {
    const trimmed = passName.trim().toUpperCase();
    return trimmed.replace(/\s+(\d+)$/, " #$1");
}

function scrollPassTrackToLevel(passLevel: number, passItems: PassRewardDef[]) {
    const track = $("#start-menu #pass-items-wrapper");
    if (track.length == 0 || passItems.length == 0) return;

    let activeRewardIdx = passItems.findIndex((reward) => reward.level >= passLevel);
    if (activeRewardIdx == -1) {
        activeRewardIdx = passItems.length - 1;
    }
    const activeColumnIdx = activeRewardIdx;
    const itemWidth = 126;
    const visibleLeadColumns = 1;
    track.scrollLeft(Math.max(0, (activeColumnIdx - visibleLeadColumns) * itemWidth));
}

function getPassTrackWidth(passItemCount: number) {
    const itemWidth = 115;
    const itemGap = 11;
    return Math.max(534, passItemCount * (itemWidth + itemGap));
}

function createGoldPotatoReward(amount: number) {
    return $("<div/>", { class: "item-golden_potato" }).append(
        $("<div/>", { class: "gold-potato-container" }).append(
            $("<div/>", { class: "gold-potato-amount" }).append(
                $("<div/>", { text: String(amount) }),
            ),
        ),
    );
}

function createPassLock() {
    return $("<div/>", { class: "pass-lock-container" }).append(
        $("<div/>", { class: "pass-lock" }),
    );
}

function hasPremiumPassUnlock(passData: unknown) {
    const unlocks = (passData as { unlocks?: Record<string, boolean> }).unlocks;
    return !!unlocks?.[premiumPassUnlockType];
}

function humanizeTime(time: number, minutesFloor = false) {
    // const minutesFloor =
    //     arguments.length > 1 &&
    //     arguments[1] !== undefined &&
    //     arguments[1];
    const hours = Math.floor(Math.ceil(time / 60) / 60);
    const minutes = minutesFloor ? Math.floor(time / 60) % 60 : Math.ceil(time / 60) % 60;
    Math.floor(time);
    let timeText = "";
    if (hours > 0) {
        timeText += `${hours}h `;
    }
    return (timeText += `${minutes}m`);
}

type QuestUiState = {
    data: {
        idx: number;
        type: string;
        complete: boolean;
        progress: number;
        target: number;
        rerolled: boolean;
        title?: string;
        gpReward?: number;
        timeToRefresh?: number;
    };
    start: number;
    current: number;
    ticker: number;
    delay: number;
    playCompleteAnim: boolean;
    progressAnimFinished: boolean;
    completeAnimFinished: boolean;
    shouldRequestRefresh: boolean;
    refreshTime: number;
    refreshSet: boolean;
    refreshEnabled: boolean;
    timer: {
        enabled: boolean;
        str: string;
        displayed: boolean;
    };
    elems: Record<string, JQuery<HTMLElement>>;
};

export class Pass {
    pass = {
        data: {
            type: CurrentPassType,
        },
        currentXp: 0,
        currentLevel: 1,
        levelXp: 0,
        ticker: 0,
        animSteps: [] as Array<{
            startXp: number;
            targetXp: number;
            levelXp: number;
            targetLevel: number;
        }>,
        elems: {},
    };

    quests: QuestUiState[] = [];
    sideQuests: QuestUiState[] = [];

    loaded = false;
    lockDisplayed = false;
    updatePass = false;
    updatePassTicker = 0;
    passItemsSignature = "";
    premiumPassPurchasePending = false;
    fullPassPurchasePending = false;
    rewardedAdGpPending = false;
    rewardedAdGpMessage = "";
    rewardedAdGpTimeout = 0;
    premiumPassModal = new MenuModal($("#modal-premium-pass-confirm"));

    constructor(
        public account: Account,
        public loadoutMenu: LoadoutMenu,
        public localization: Localization,
    ) {
        this.account = account;
        this.loadoutMenu = loadoutMenu;
        this.localization = localization;

        this.account.addEventListener("request", this.onRequest.bind(this));
        this.account.addEventListener("pass", this.onPass.bind(this));
        this.account.addEventListener("rewardedAdGp", this.renderRewardedAdGp.bind(this));
        this.loadPlaceholders();
        $("#start-menu .pass-items-container").on("wheel", (event) => {
            const nativeEvent = event.originalEvent as WheelEvent | undefined;
            if (!nativeEvent) return;

            const container = event.currentTarget;
            const scrollDelta =
                Math.abs(nativeEvent.deltaX) > Math.abs(nativeEvent.deltaY)
                    ? nativeEvent.deltaX
                    : nativeEvent.deltaY;
            if (scrollDelta === 0) return;

            const maxScrollLeft = container.scrollWidth - container.clientWidth;
            if (maxScrollLeft <= 0) return;

            const scrollLeft = math.clamp(
                container.scrollLeft + scrollDelta,
                0,
                maxScrollLeft,
            );
            if (scrollLeft === container.scrollLeft) return;

            container.scrollLeft = scrollLeft;
            nativeEvent.preventDefault();
            nativeEvent.stopPropagation();
        });
        $("#pass-progress-unlock-wrapper")
            .on("mouseenter", () => {
                $("#pass-unlock-tooltip").fadeIn(50);
            })
            .on("mouseleave", () => {
                $("#pass-unlock-tooltip").fadeOut(50);
            });
        $("#pass-buy-btn").on("click", () => {
            this.showPremiumPassModal();
        });
        $("#premium-pass-confirm-yes").on("click", () => {
            this.buyPremiumPass();
        });
        $("#premium-pass-unlock-all-yes").on("click", () => {
            this.buyFullPass();
        });
        $("#rewarded-ad-gp-button").on("click", () => {
            this.requestRewardedAdGp();
        });
    }

    onPass(pass: any, quests: any[], resetRefresh: boolean) {
        const refreshOffset = 5 * 1000;
        const newQuests = [];
        $("#pass-items-wrapper").removeClass("logged-out").addClass("logged-in");
        this.pass.data = pass;
        this.renderSideQuests();
        let questAnimCount = 0;
        for (let passIdx = 0; passIdx < quests.length; passIdx++) {
            const questData = quests[passIdx];
            const quest = {
                data: questData,
                start: 0,
                current: 0,
                ticker: 0,
                delay: questAnimCount * 0.5,
                playCompleteAnim: false,
                progressAnimFinished: false,
                completeAnimFinished: false,
                shouldRequestRefresh: resetRefresh,
                refreshTime: Date.now() + questData.timeToRefresh + refreshOffset,
                refreshSet: false,
                refreshEnabled: false,
                timer: {
                    enabled: false,
                    str: "",
                },
            } as QuestUiState;
            const curQuest = this.quests.find((existingQuest) => {
                return (
                    existingQuest.data.idx == quest.data.idx &&
                    existingQuest.data.type == quest.data.type
                );
            });

            if (curQuest) {
                quest.start = curQuest.current;
                quest.current = curQuest.current;
                if (!curQuest.data.complete && quest.data.complete) {
                    quest.playCompleteAnim = true;
                }
            }
            quest.data.progress = math.min(quest.data.progress, quest.data.target);
            if (quest.data.progress > quest.current) {
                questAnimCount++;
            }
            const fixedQuestElem = $(`#pass-quest-${quest.data.idx}`);
            quest.elems = {
                main: fixedQuestElem,
                xp: fixedQuestElem.find(".pass-quest-xp"),
                info: fixedQuestElem.find(".pass-quest-info"),
                desc: fixedQuestElem.find(".pass-quest-desc"),
                cur: fixedQuestElem.find(".pass-quest-counter-current"),
                target: fixedQuestElem.find(".pass-quest-counter-target"),
                refresh: fixedQuestElem.find(".pass-quest-refresh"),
                refreshPrompt: fixedQuestElem.find(".pass-quest-refresh-prompt"),
                refreshConfirm: fixedQuestElem.find(".pass-quest-refresh-confirm"),
                refreshCancel: fixedQuestElem.find(".pass-quest-refresh-cancel"),
                counter: fixedQuestElem.find(".pass-quest-counter"),
                barFill: fixedQuestElem.find(".pass-quest-bar-fill"),
                timer: fixedQuestElem.find(".pass-quest-timer"),
                loading: fixedQuestElem.find(".pass-quest-spinner"),
            };
            quest.elems.barFill.clearQueue();
            quest.elems.main.removeClass("pass-bg-pulse");
            quest.elems.main.stop().css({
                opacity: 1,
            });
            quest.elems.xp.removeClass("pass-text-pulse");
            quest.elems.refresh.stop().css({
                opacity: 1,
            });
            quest.elems.counter.stop().css({
                opacity: 1,
            });

            // Initialize quest UI
            const questDef = QuestDefs[quest.data.type];
            const title =
                this.localization.translate(`${quest.data.type}`) || quest.data.type;
            const pct = (quest.current / quest.data.target) * 100;
            quest.elems.main.css("display", "block");
            quest.elems.desc.html(title);
            quest.elems.cur.html(Math.round(quest.current));
            quest.elems.xp.html(`${questDef.xp} XP`);
            quest.elems.barFill.css({
                width: `${pct}%`,
            });
            quest.elems.loading.css("display", "none");

            // Humanize time for survival quests
            let targetText: string | number = quest.data.target;
            if (questDef.event === "survived") {
                targetText = humanizeTime(targetText);
            }

            quest.elems.target.html(targetText);
            if (questDef.icon) {
                quest.elems.desc.addClass("pass-quest-desc-icon");
                quest.elems.desc.css({
                    "background-image": `url(${questDef.icon})`,
                });
            } else {
                quest.elems.desc.removeClass("pass-quest-desc-icon");
                quest.elems.desc.attr("style", "");
            }
            this.setQuestRefreshEnabled(quest);
            newQuests.push(quest);
        }
        this.quests = newQuests;
        this.pass.animSteps = [];
        this.pass.currentXp = Math.round(this.pass.currentXp);
        this.pass.levelXp = passUtil.getPassLevelXp(pass.type, this.pass.currentLevel);
        if (!this.loaded) {
            const initialLevelXp = passUtil.getPassLevelXp(pass.type, pass.level);
            this.pass.currentXp = 0;
            this.pass.currentLevel = pass.level;
            this.pass.levelXp = initialLevelXp;
            this.pass.ticker = 0;
        }
        let level = this.pass.currentLevel;
        let xp = this.pass.currentXp;
        const shouldFastForwardPassProgress =
            this.loaded && pass.level - this.pass.currentLevel > 5;
        // Animate level-ups

        if (shouldFastForwardPassProgress) {
            this.pass.currentLevel = pass.level;
            this.pass.currentXp = pass.xp;
            this.pass.levelXp = passUtil.getPassLevelXp(pass.type, pass.level);
            this.pass.ticker = 0;
        } else if (this.loaded) {
            while (level < pass.level) {
                const levelXp = passUtil.getPassLevelXp(pass.type, level);
                this.pass.animSteps.push({
                    startXp: xp,
                    targetXp: levelXp,
                    levelXp,
                    targetLevel: level + 1,
                });
                level++;
                xp = 0;
            }
            const delay = questAnimCount > 0 ? 2 : 0;
            this.pass.ticker = -delay;

            // Animate leftover xp
            const levelXp = passUtil.getPassLevelXp(pass.type, level);
            this.pass.animSteps.push({
                startXp: xp,
                targetXp: pass.xp,
                levelXp,
                targetLevel: level,
            });
        } else {
            const levelXp = passUtil.getPassLevelXp(pass.type, level);
            this.pass.animSteps.push({
                startXp: xp,
                targetXp: pass.xp,
                levelXp,
                targetLevel: level,
            });
        }
        $("#pass-block").css("z-index", "1");
        $("#pass-locked").css("display", "none");
        $("#pass-loading").css("display", "none");
        const unlockItemId = getNextPassUnlockItemId(
            this.pass.data.type,
            this.pass.currentLevel,
        );
        this.setPassUnlockImage(unlockItemId);
        const passNameText = formatPassName(this.localization.translate(pass.type));
        $("#pass-name-text").html(passNameText);
        $("#pass-progress-level").html(this.pass.currentLevel);
        $("#pass-progress-xp-current").html(this.pass.currentXp);
        $("#pass-progress-xp-target").html(this.pass.levelXp);
        const pct =
            this.pass.currentLevel >= passUtil.getPassMaxLevel()
                ? 100
                : (this.pass.currentXp / this.pass.levelXp) * 100;
        $("#pass-progress-bar-fill").css({
            width: `${pct}%`,
        });
        this.populatePassItems({
            autoScroll: !this.loaded,
            preserveScroll: this.loaded,
        });
        this.updatePassTrackProgress(this.pass.currentLevel, this.pass.currentXp);
        this.loaded = true;
    }

    renderSideQuests() {
        const container = $("#side-quest-list");
        container.empty();

        const sideQuests = this.account.sideQuests || [];
        $("#side-quest-section").css("display", sideQuests.length > 0 ? "block" : "none");

        const nextSideQuests: QuestUiState[] = [];
        for (const questData of sideQuests) {
            questData.progress = math.min(questData.progress, questData.target);
            const previousQuest = this.sideQuests.find((existingQuest) => {
                return (
                    existingQuest.data.idx === questData.idx &&
                    existingQuest.data.type === questData.type
                );
            });
            const quest = {
                data: questData,
                start: previousQuest?.current ?? 0,
                current: previousQuest?.current ?? 0,
                ticker: 0,
                delay: 0,
                playCompleteAnim:
                    !!previousQuest && !previousQuest.data.complete && questData.complete,
                progressAnimFinished: false,
                completeAnimFinished: false,
                shouldRequestRefresh: false,
                refreshTime: Date.now() + questData.timeToRefresh,
                refreshSet: true,
                refreshEnabled: !questData.complete && questData.timeToRefresh <= 0,
                timer: {
                    enabled: questData.complete,
                    str: "",
                    displayed: false,
                },
                elems: {},
            } as QuestUiState;

            const isSurvivalQuest = quest.data.type === "side_quest_survive_10m";
            const currentText = isSurvivalQuest
                ? `${Math.floor(quest.current / 60)}m`
                : `${Math.round(quest.current)}`;
            const targetText = isSurvivalQuest
                ? `${Math.floor(quest.data.target / 60)}m`
                : `${quest.data.target}`;
            const card = $("<div/>", {
                class: `pass-quest side-quest ${quest.data.complete ? "complete" : ""}`,
            });
            const timer = $("<div/>", {
                class: "pass-quest-timer side-quest-timer",
            }).css("display", "none");
            const info = $("<div/>", { class: "pass-quest-info" });
            const desc = $("<div/>", {
                class: "pass-quest-desc",
                text: quest.data.complete
                    ? `${quest.data.title} complete`
                    : quest.data.title,
            });
            const reward = $("<div/>", {
                class: "pass-quest-xp side-quest-reward",
                text: `${quest.data.gpReward?.toLocaleString() ?? 0} GP`,
            });
            const refresh = $("<div/>", {
                class: `pass-quest-refresh ${quest.refreshEnabled ? "" : "pass-quest-refresh-disabled"}`,
                title: quest.refreshEnabled ? "Change side quest" : "",
            }).on("click", () => {
                if (!quest.refreshEnabled) return;
                this.account.refreshQuest(quest.data.idx);
            });
            const barFill = $("<div/>", { class: "pass-quest-bar-fill" }).css({
                width: `${(quest.current / quest.data.target) * 100}%`,
            });
            const cur = $("<span/>", {
                class: "pass-quest-counter-current",
                text: currentText,
            });
            const target = $("<span/>", {
                class: "pass-quest-counter-target",
                text: targetText,
            });
            const counter = $("<div/>", { class: "pass-quest-counter" }).append(
                cur,
                $("<span/>", { text: "/" }),
                target,
            );
            info.append(
                desc,
                reward,
                refresh,
                $("<div/>", { class: "pass-quest-progress" }).append(
                    $("<div/>", { class: "pass-quest-bar" }).append(barFill),
                    counter,
                ),
            );
            card.append(timer, info);
            container.append(card);

            quest.elems = {
                main: card,
                xp: reward,
                info,
                desc,
                cur,
                target,
                refresh,
                counter,
                barFill,
                timer,
            };
            nextSideQuests.push(quest);
        }
        this.sideQuests = nextSideQuests;
        this.renderRewardedAdGp();
    }

    renderRewardedAdGp() {
        const state = this.account.rewardedAdGp;
        const section = $("#rewarded-ad-gp-section");
        const button = $("#rewarded-ad-gp-button");
        const title = $("#rewarded-ad-gp-title");
        const amountText = $("#rewarded-ad-gp-amount");
        const status = $("#rewarded-ad-gp-status");

        section.css(
            "display",
            this.account.loggedIn && googleH5Ads.enabled() ? "flex" : "none",
        );
        if (!this.account.loggedIn || !googleH5Ads.enabled()) return;

        const amount = state?.amount ?? 50;
        const remaining = state?.remaining ?? 0;
        const limit = state?.limit ?? 2;
        const disabled = this.rewardedAdGpPending || remaining <= 0;
        button
            .prop("disabled", disabled)
            .toggleClass("rewarded-ad-gp-disabled", disabled)
            .attr(
                "title",
                remaining > 0
                    ? `Watch a full video ad for ${amount} GP`
                    : "Daily video rewards claimed",
            );
        title.text(this.rewardedAdGpPending ? "Loading Video" : "Video Reward");
        amountText.text(String(amount));
        status.text(
            this.rewardedAdGpMessage ||
                (remaining > 0
                    ? `${remaining}/${limit} left today`
                    : `Come back in ${humanizeTime(
                          Math.max(0, (state?.resetAt ?? Date.now()) - Date.now()) /
                              1000,
                          true,
                      )}`),
        );
    }

    requestRewardedAdGp() {
        const state = this.account.rewardedAdGp;
        if (
            this.rewardedAdGpPending ||
            !this.account.loggedIn ||
            state?.remaining === 0
        ) {
            return;
        }

        let rewardViewed = false;
        let adStarted = false;
        this.rewardedAdGpPending = true;
        this.rewardedAdGpMessage = "";
        this.renderRewardedAdGp();

        window.clearTimeout(this.rewardedAdGpTimeout);
        this.rewardedAdGpTimeout = window.setTimeout(() => {
            if (!this.rewardedAdGpPending || adStarted) return;
            this.rewardedAdGpPending = false;
            this.rewardedAdGpMessage =
                "No test video loaded. Disable ad blockers and use ?adbreak_test=on.";
            this.renderRewardedAdGp();
        }, 12000);

        googleH5Ads.requestReward("watch-video-gp", {
            beforeAd: () => {
                adStarted = true;
                window.clearTimeout(this.rewardedAdGpTimeout);
            },
            adViewed: () => {
                rewardViewed = true;
                window.clearTimeout(this.rewardedAdGpTimeout);
                this.account.claimRewardedAdGp((error) => {
                    this.rewardedAdGpPending = false;
                    if (error) {
                        this.rewardedAdGpMessage =
                            error === "daily_limit"
                                ? "Daily video reward limit reached"
                                : "Reward failed. Try again later.";
                    }
                    this.renderRewardedAdGp();
                });
            },
            adDismissed: () => {
                window.clearTimeout(this.rewardedAdGpTimeout);
                this.rewardedAdGpMessage = "Watch the full video to earn GP.";
            },
            adBreakDone: () => {
                if (rewardViewed) return;
                window.clearTimeout(this.rewardedAdGpTimeout);
                this.rewardedAdGpPending = false;
                if (!this.rewardedAdGpMessage) {
                    this.rewardedAdGpMessage = "No video ad available right now.";
                }
                this.renderRewardedAdGp();
            },
        });
    }

    getPassItemsSignature(passType: string) {
        const passDef = PassDefs[passType as keyof typeof PassDefs];
        if (!passDef) return "";
        const serializeReward = (reward: PassRewardDef) =>
            "item" in reward
                ? `${reward.level}:${reward.item}:${reward.gp ?? ""}`
                : `${reward.level}:gp:${reward.gp}`;
        return JSON.stringify({
            passType,
            items: passDef.items.map(serializeReward),
            premiumItems: passDef.premiumItems?.map(serializeReward) ?? [],
        });
    }

    populatePassItems(options: { autoScroll?: boolean; preserveScroll?: boolean } = {}) {
        const passDef = PassDefs[this.pass.data.type as keyof typeof PassDefs];
        const passItemsList = $("#pass-items-list");
        const passItemsWrapper = $("#start-menu #pass-items-wrapper");
        const previousScrollLeft = passItemsWrapper.scrollLeft() || 0;
        passItemsList.empty();
        const basicPassItems = $(".pass-basic-items");
        const premiumPassItems = $(".pass-premium-items");
        const passProgressLevels = $(".pass-progress-levels");
        basicPassItems.empty();
        premiumPassItems.empty();
        passProgressLevels.empty();

        if (!passDef.items) return;
        this.passItemsSignature = this.getPassItemsSignature(this.pass.data.type);

        const passLevel = this.account.loggedIn
            ? ((this.pass.data as { level?: number }).level ?? this.pass.currentLevel)
            : 0;
        const passXp = this.account.loggedIn
            ? ((this.pass.data as { xp?: number }).xp ?? this.pass.currentXp)
            : 0;
        const ownsPremiumPass = hasPremiumPassUnlock(this.pass.data);
        this.updatePremiumPassButton(ownsPremiumPass, passLevel);
        const highestRewardLevel = passDef.items.reduce(
            (highest, reward) => Math.max(highest, reward.level),
            1,
        );
        const passItemCount = passDef.items.length;
        const trackWidth = getPassTrackWidth(passItemCount);
        $("#pass-items-wrapper .pass-basic-items").css("width", `${trackWidth}px`);
        $("#pass-items-wrapper .pass-premium-items").css("width", `${trackWidth}px`);
        $("#pass-items-wrapper .pass-progress").css("width", `${trackWidth}px`);
        $("#pass-items-wrapper .pass-progress-levels").css("width", `${trackWidth}px`);
        this.updatePassTrackProgress(passLevel, passXp, highestRewardLevel);

        for (let passItemIdx = 0; passItemIdx < passItemCount; passItemIdx++) {
            const passItem = passDef.items[passItemIdx];
            if (!passItem) continue;
            const itemLevel = passItem.level;
            const premiumPassItem =
                passDef.premiumItems?.find((reward) => reward.level === itemLevel) ??
                null;
            const isUnlocked = itemLevel <= passLevel;
            const itemName = getPassRewardName(passItem);
            const svgUrl = getPassRewardImage(passItem);
            const transform = getPassRewardTransform(passItem);
            const isGoldPotatoReward = !("item" in passItem) && "gp" in passItem;
            if (passItemsList.length > 0) {
                const itemDiv = $("<div/>", {
                    class: `pass-item ${isUnlocked ? "unlocked" : ""} ${!isUnlocked ? "pass-item-locked" : ""}`,
                });
                if (isGoldPotatoReward) {
                    itemDiv.addClass("golden");
                } else {
                    applyPassRewardRarityStyle(itemDiv, passItem);
                }
                itemDiv.append(
                    $("<div/>", { class: "pass-item-level", text: itemLevel }),
                    $("<div/>", {
                        class: "pass-item-image",
                        css: {
                            "background-image": `url(${svgUrl})`,
                            transform,
                        },
                    }),
                    $("<div/>", { class: "pass-item-name", text: itemName }),
                );

                passItemsList.append(itemDiv);
            }

            const trackItem = $("<div/>", {
                class: `pass-track-item ${isUnlocked ? "unlocked" : "locked"} ${isGoldPotatoReward ? "golden" : ""}`,
                title: `${itemName} - Level ${itemLevel}`,
            });

            if (isGoldPotatoReward) {
                trackItem.append(createGoldPotatoReward(passItem.gp));
            } else {
                applyPassRewardRarityStyle(trackItem, passItem);
                const image = $("<div/>", { class: "pass-track-item-image" });
                image.css({
                    "background-image": `url(${svgUrl})`,
                    transform,
                });
                trackItem.append(image);
            }

            const premiumItemLevel = premiumPassItem?.level ?? itemLevel;
            const premiumItemUnlocked = ownsPremiumPass && premiumItemLevel <= passLevel;
            const premiumItem = premiumPassItem
                ? this.createPremiumTrackItem(
                      premiumPassItem,
                      premiumItemUnlocked,
                      ownsPremiumPass,
                  )
                : (() => {
                      const emptySlot = $("<div/>", {
                          class: "pass-premium-item pass-track-item pass-empty-slot locked",
                          title: `Premium reward - Level ${premiumItemLevel}`,
                      });
                      if (!ownsPremiumPass) {
                          emptySlot.append(createPassLock());
                      }
                      return emptySlot;
                  })();

            basicPassItems.append(trackItem);
            premiumPassItems.append(premiumItem);
            passProgressLevels.append(
                $("<div/>", {
                    class: `hexagon ${isUnlocked ? "passed" : ""}`,
                    text: String(itemLevel),
                }),
            );
        }
        if (options.autoScroll ?? true) {
            scrollPassTrackToLevel(passLevel, passDef.items);
        } else if (options.preserveScroll) {
            passItemsWrapper.scrollLeft(previousScrollLeft);
        }
    }

    updatePremiumPassButton(ownsPremiumPass: boolean, passLevel: number) {
        const buyButton = $("#pass-buy-btn");
        if (!buyButton.length) return;

        if (ownsPremiumPass && passLevel >= passUtil.getPassMaxLevel()) {
            buyButton.addClass("premium");
            buyButton.empty().append(
                $("<div/>", { class: "pass-premium-icon" }),
                $("<div/>", {
                    class: "pass-btn-text",
                    text: "ALL ITEMS UNLOCKED",
                }),
                $("<div/>", { class: "pass-premium-icon" }),
            );
            return;
        }

        buyButton.removeClass("premium btn-disabled");
        buyButton.empty().append(
            $("<div/>", { class: "pass-premium-icon" }),
            $("<div/>", {
                class: "pass-btn-text",
                text: "UNLOCK PASS",
            }),
            $("<div/>", { class: "pass-premium-icon" }),
        );
    }

    createPremiumTrackItem(
        passItem: PassRewardDef,
        isUnlocked: boolean,
        ownsPremiumPass: boolean,
    ) {
        const itemName = getPassRewardName(passItem);
        const svgUrl = getPassRewardImage(passItem);
        const transform = getPassRewardTransform(passItem);
        const isGoldPotatoReward = !("item" in passItem) && "gp" in passItem;
        const trackItem = $("<div/>", {
            class: `pass-premium-item pass-track-item premium ${isUnlocked ? "unlocked" : "locked"} ${isGoldPotatoReward ? "golden" : ""}`,
            title: `${itemName} - Premium Level ${passItem.level}`,
        });

        if (isGoldPotatoReward) {
            trackItem.append(createGoldPotatoReward(passItem.gp));
        } else {
            applyPassRewardRarityStyle(trackItem, passItem);
            trackItem.append(
                $("<div/>", {
                    class: "pass-track-item-image",
                    css: {
                        "background-image": `url(${svgUrl})`,
                        transform,
                    },
                }),
            );
        }

        if (!isUnlocked) {
            if (!ownsPremiumPass) {
                trackItem.append(createPassLock());
                trackItem.addClass("premium-pass-required");
            }
        }

        return trackItem;
    }

    showPremiumPassModal() {
        if (!this.account.loggedIn) {
            $(document).trigger("pass-login-required");
            return;
        }
        $("#premium-pass-confirm-error").text("").hide();
        const passDef = PassDefs[this.pass.data.type as keyof typeof PassDefs];
        const premiumPrice = passDef.premiumPrice ?? defaultPremiumPassPrice;
        const unlockAllPrice = passDef.unlockAllPrice ?? defaultUnlockAllPassPrice;
        const passLevel =
            (this.pass.data as { level?: number }).level ?? this.pass.currentLevel;
        const ownsPremiumPass = hasPremiumPassUnlock(this.pass.data);
        const ownsAllItems = ownsPremiumPass && passLevel >= passUtil.getPassMaxLevel();
        $("#premium-pass-confirm-yes")
            .toggleClass("btn-disabled", ownsPremiumPass)
            .find("> span")
            .text(ownsPremiumPass ? "Premium Pass Unlocked" : "Buy Premium Pass");
        $("#premium-pass-unlock-all-yes")
            .toggleClass("btn-disabled", ownsAllItems)
            .find("> span")
            .text(ownsAllItems ? "All Items Unlocked" : "Unlock All Items");
        $("#premium-pass-price").text(String(premiumPrice));
        $("#premium-pass-price-footer").text(String(premiumPrice));
        $("#unlock-all-pass-price-footer").text(String(unlockAllPrice));
        this.premiumPassModal.show(true);
    }

    isModalButtonDisabled(selector: string) {
        return $(selector).hasClass("btn-disabled");
    }

    buyPremiumPass() {
        if (
            this.premiumPassPurchasePending ||
            this.isModalButtonDisabled("#premium-pass-confirm-yes")
        ) {
            return;
        }
        this.premiumPassPurchasePending = true;
        $("#premium-pass-confirm-error").text("").hide();
        $("#premium-pass-confirm-yes").addClass("btn-disabled");
        this.account.buyPremiumPass((error) => {
            this.premiumPassPurchasePending = false;
            $("#premium-pass-confirm-yes").removeClass("btn-disabled");
            if (error) {
                const message =
                    error === "not_enough_gp"
                        ? "Not enough GP."
                        : error === "already_purchased"
                          ? "You already unlocked the premium pass for this pass."
                          : "Premium pass purchase failed.";
                $("#premium-pass-confirm-error").text(message).show();
                return;
            }
            this.premiumPassModal.hide();
        });
    }

    buyFullPass() {
        if (
            this.fullPassPurchasePending ||
            this.isModalButtonDisabled("#premium-pass-unlock-all-yes")
        ) {
            return;
        }
        this.fullPassPurchasePending = true;
        $("#premium-pass-confirm-error").text("").hide();
        $("#premium-pass-unlock-all-yes").addClass("btn-disabled");
        this.account.buyFullPass((error) => {
            this.fullPassPurchasePending = false;
            $("#premium-pass-unlock-all-yes").removeClass("btn-disabled");
            if (error) {
                const message =
                    error === "not_enough_gp"
                        ? "Not enough GP."
                        : error === "already_purchased"
                          ? "You already unlocked every reward for this pass."
                          : "Unlock all purchase failed.";
                $("#premium-pass-confirm-error").text(message).show();
                return;
            }
            this.premiumPassModal.hide();
        });
    }

    updatePassTrackProgress(
        passLevel: number,
        currentXp: number,
        highestRewardLevel?: number,
    ) {
        const passDef = PassDefs[this.pass.data.type as keyof typeof PassDefs];
        const currentLevel = Math.max(1, passLevel);
        const levelXp = passUtil.getPassLevelXp(this.pass.data.type, currentLevel);
        const levelProgress =
            passLevel > 0 && levelXp > 0 ? math.clamp(currentXp / levelXp, 0, 1) : 0;
        const currentPassProgress = currentLevel + levelProgress;
        const rewardItems = passDef.items;
        const lastRewardIdx = rewardItems.findLastIndex(
            (reward) => reward.level <= currentPassProgress,
        );
        const nextRewardIdx = rewardItems.findIndex(
            (reward) => reward.level > currentPassProgress,
        );
        let rewardProgress = 0;

        if (rewardItems.length > 0) {
            if (lastRewardIdx < 0) {
                const firstRewardLevel = rewardItems[0]!.level;
                rewardProgress =
                    firstRewardLevel > 1
                        ? math.clamp(
                              (currentPassProgress - 1) / (firstRewardLevel - 1),
                              0,
                              1,
                          ) * 0.5
                        : 0;
            } else if (nextRewardIdx < 0) {
                rewardProgress = rewardItems.length - 0.5;
            } else {
                const lastReward = rewardItems[lastRewardIdx]!;
                const nextReward = rewardItems[nextRewardIdx]!;
                const betweenRewards =
                    nextReward.level > lastReward.level
                        ? math.clamp(
                              (currentPassProgress - lastReward.level) /
                                  (nextReward.level - lastReward.level),
                              0,
                              1,
                          )
                        : 0;
                rewardProgress = lastRewardIdx + 0.5 + betweenRewards;
            }
        }
        const passPercent = math.clamp(
            rewardItems.length > 0 ? (rewardProgress / rewardItems.length) * 100 : 0,
            0,
            100,
        );
        $("#start-menu #pass-items-wrapper .pass-progress-bar-fill").css({
            width: `${passPercent}%`,
        });
    }

    onRequest(account: Account) {
        $("#pass-loading").css("display", account.loggingIn ? "block" : "none");
    }

    scheduleUpdatePass(delay: number) {
        this.updatePass = true;
        this.updatePassTicker = delay;
    }

    setQuestRefreshEnabled(quest: QuestUiState) {
        const shouldEnableRefresh =
            (!quest.data.rerolled && !quest.data.complete) ||
            quest.refreshTime - Date.now() < 0;
        if (shouldEnableRefresh != quest.refreshEnabled || !quest.refreshSet) {
            quest.refreshEnabled = shouldEnableRefresh;
            quest.refreshSet = true;
            quest.elems.refresh.off("click");
            quest.elems.refreshConfirm.off("click");
            quest.elems.refreshCancel.off("click");
            if (quest.refreshEnabled) {
                quest.elems.refreshConfirm.on("click", () => {
                    quest.elems.loading.css("display", "block");
                    quest.elems.refreshPrompt.css("display", "none");
                    this.account.refreshQuest(quest.data.idx);
                });
                quest.elems.refreshCancel.on("click", () => {
                    quest.elems.refreshPrompt.css("display", "none");
                    quest.elems.info.css("display", "block");
                });
                quest.elems.refresh.on("click", () => {
                    quest.elems.refreshPrompt.css("display", "block");
                    quest.elems.info.css("display", "none");
                });
                quest.elems.refresh.removeClass("pass-quest-refresh-disabled");
            } else {
                quest.elems.refresh.addClass("pass-quest-refresh-disabled");
            }
        }
    }

    setPassUnlockImage(reward: PassRewardDef | null) {
        const item = reward && "item" in reward ? reward.item : "";
        const emoteDef = item ? (GameObjectDefs[item] as EmoteDef) : undefined;
        const unlockImagePath = reward
            ? getPassRewardImage(reward)
            : "img/emotes/surviv.svg";
        const unlockImageUrl = `url(${unlockImagePath})`;
        const unlockImageTransform = reward ? getPassRewardTransform(reward) : "";
        $("#pass-progress-unlock").css({
            opacity: reward ? 1 : 0.15,
            transform: `translate(-50%, -50%) ${unlockImageTransform}`,
        });
        $("#pass-progress-unlock-image").css({
            "background-image": unlockImageUrl,
        });
        const unlockTypeTitle = emoteDef
            ? this.localization
                  .translate(
                      `loadout-title-${this.loadoutMenu.getCategory(emoteDef.type)!.loadoutType}`,
                  )
                  .toUpperCase()
            : reward && "gp" in reward
              ? "CURRENCY"
              : "";
        const tooltipElem = $("#pass-unlock-tooltip");
        tooltipElem.css("opacity", reward ? 1 : 0);
        tooltipElem.find(".tooltip-pass-title").html(unlockTypeTitle);
        tooltipElem
            .find(".tooltip-pass-desc")
            .html(reward ? getPassRewardName(reward) : "");
        const unlockTypeImageUrl = emoteDef
            ? `url(${this.loadoutMenu.getCategory(emoteDef.type)!.categoryImage})`
            : reward && "gp" in reward
              ? "url(img/loot/loot-golde-potato.svg)"
              : "";
        $("#pass-progress-unlock-type-image").css({
            "background-image": unlockTypeImageUrl,
        });
        $("#pass-progress-unlock-type-wrapper").css({
            display: reward ? "block" : "none",
        });
    }

    animatePassLevelUp() {
        const passProgressBarFill = $("#pass-progress-bar-fill");
        const passProgressLevel = $("#pass-progress-level");
        const passProgressUnlockWrapperEle = $("#pass-progress-unlock-wrapper");
        const passProgressUnlockImageEle = $("#pass-progress-unlock-image");
        const passProgressUnlockTypeImageEle = $("#pass-progress-unlock-type-image");
        passProgressLevel.html(this.pass.currentLevel);
        passProgressBarFill
            .queue((next) => {
                passProgressUnlockWrapperEle.addClass("pass-unlock-pulse");
                $(next).dequeue();
            })
            .delay(750)
            .queue((next) => {
                passProgressUnlockImageEle.animate(
                    {
                        opacity: 0,
                    },
                    250,
                );
                passProgressUnlockTypeImageEle.animate(
                    {
                        opacity: 0,
                    },
                    250,
                );
                $(next).dequeue();
            })
            .delay(250)
            .queue((next) => {
                const nextUnlockItemId = getNextPassUnlockItemId(
                    this.pass.data.type,
                    this.pass.currentLevel,
                );
                this.setPassUnlockImage(nextUnlockItemId);
                passProgressUnlockWrapperEle.removeClass("pass-unlock-pulse");
                passProgressUnlockImageEle.animate(
                    {
                        opacity: 1,
                    },
                    250,
                );
                passProgressUnlockTypeImageEle.animate(
                    {
                        opacity: 1,
                    },
                    250,
                );
                $(next).dequeue();
            });
    }

    animateQuestComplete(quest: QuestUiState) {
        quest.elems.barFill
            .queue((el) => {
                quest.elems.main.addClass("pass-bg-pulse");
                quest.elems.xp.addClass("pass-text-pulse");
                quest.elems.refresh.animate(
                    {
                        opacity: 0.25,
                    },
                    250,
                );
                quest.elems.refresh.removeClass("pass-quest-refresh-disabled");
                quest.elems.refresh.animate(
                    {
                        opacity: 0,
                    },
                    250,
                );
                quest.elems.counter.animate(
                    {
                        opacity: 0,
                    },
                    250,
                );
                quest.elems.desc.html("QUEST COMPLETE!");
                $(el).dequeue();
            })
            .delay(1000)
            .queue((el) => {
                quest.elems.main.animate(
                    {
                        opacity: 0,
                    },
                    750,
                );
                $(el).dequeue();
            });
    }

    update(dt: number) {
        $("#pass-items-wrapper").css("display", "block");
        const currentPassItemsSignature = this.getPassItemsSignature(this.pass.data.type);
        if (
            currentPassItemsSignature &&
            currentPassItemsSignature !== this.passItemsSignature
        ) {
            this.populatePassItems({
                autoScroll: false,
                preserveScroll: true,
            });
        }
        this.updatePassTicker -= dt;

        if (this.updatePass && this.updatePassTicker < 0) {
            this.updatePass = false;
            this.account.getPass(false);
        }
        for (let questIndex = 0; questIndex < this.quests.length; questIndex++) {
            const fixedQuest = this.quests[questIndex];
            this.setQuestRefreshEnabled(fixedQuest);
            fixedQuest.ticker += dt;
            if (!fixedQuest.progressAnimFinished) {
                const progressT = math.clamp(
                    (fixedQuest.ticker - fixedQuest.delay) / 1,
                    0,
                    1,
                );
                fixedQuest.current = math.lerp(
                    math.easeOutExpo(progressT),
                    fixedQuest.start,
                    fixedQuest.data.progress,
                );
                const pctComplete = (fixedQuest.current / fixedQuest.data.target) * 100;

                // Humanize time for survival quests
                const questDef = QuestDefs[fixedQuest.data.type];
                let currentText: number | string = Math.round(fixedQuest.current);
                if (questDef.event === "survived") {
                    currentText = humanizeTime(currentText, true);
                }
                fixedQuest.elems.cur.html(currentText);
                fixedQuest.elems.barFill.css({
                    width: `${pctComplete}%`,
                });
                if (progressT >= 1) {
                    fixedQuest.progressAnimFinished = true;
                }
            }
            if (
                fixedQuest.playCompleteAnim &&
                !fixedQuest.completeAnimFinished &&
                fixedQuest.ticker - fixedQuest.delay > 1.25
            ) {
                this.animateQuestComplete(fixedQuest);
                fixedQuest.completeAnimFinished = true;
            }
            const completionPhaseReady =
                !fixedQuest.playCompleteAnim ||
                (fixedQuest.completeAnimFinished &&
                    fixedQuest.ticker - fixedQuest.delay > 4.25);
            if (
                fixedQuest.data.complete &&
                completionPhaseReady &&
                fixedQuest.refreshEnabled &&
                fixedQuest.shouldRequestRefresh
            ) {
                fixedQuest.shouldRequestRefresh = false;
                this.account.refreshQuest(fixedQuest.data.idx);
            }
            const showRefreshTimer = fixedQuest.data.complete && completionPhaseReady;
            if (showRefreshTimer != fixedQuest.timer.displayed) {
                fixedQuest.timer.displayed = showRefreshTimer;
                fixedQuest.elems.main.removeClass("pass-bg-pulse");
                fixedQuest.elems.main.stop().animate(
                    {
                        opacity: 1,
                    },
                    250,
                );
                const isRefreshPromptVisible =
                    fixedQuest.elems.refreshPrompt.css("display") == "block";
                fixedQuest.elems.info.css(
                    "display",
                    showRefreshTimer || isRefreshPromptVisible ? "none" : "block",
                );
                fixedQuest.elems.timer.css(
                    "display",
                    showRefreshTimer ? "block" : "none",
                );
            }
            if (showRefreshTimer) {
                const refreshTimeRemainingMs = Math.max(
                    fixedQuest.refreshTime - Date.now(),
                    0,
                );
                const refreshTimeText = humanizeTime(refreshTimeRemainingMs / 1000);
                if (refreshTimeText != fixedQuest.timer.str) {
                    fixedQuest.timer.str = refreshTimeText;
                    fixedQuest.elems.timer.html(refreshTimeText);
                }
            }
        }
        for (const sideQuest of this.sideQuests) {
            sideQuest.ticker += dt;
            if (!sideQuest.progressAnimFinished) {
                const progressT = math.clamp(sideQuest.ticker / 1, 0, 1);
                sideQuest.current = math.lerp(
                    math.easeOutExpo(progressT),
                    sideQuest.start,
                    sideQuest.data.progress,
                );
                const pctComplete = (sideQuest.current / sideQuest.data.target) * 100;
                const isSurvivalQuest = sideQuest.data.type === "side_quest_survive_10m";
                const currentText = isSurvivalQuest
                    ? `${Math.floor(sideQuest.current / 60)}m`
                    : `${Math.round(sideQuest.current)}`;
                sideQuest.elems.cur.html(currentText);
                sideQuest.elems.barFill.css({
                    width: `${pctComplete}%`,
                });
                if (progressT >= 1) {
                    sideQuest.progressAnimFinished = true;
                }
            }
            if (
                sideQuest.playCompleteAnim &&
                !sideQuest.completeAnimFinished &&
                sideQuest.ticker > 1.25
            ) {
                this.animateQuestComplete(sideQuest);
                sideQuest.completeAnimFinished = true;
            }
            const completionPhaseReady =
                !sideQuest.playCompleteAnim ||
                (sideQuest.completeAnimFinished && sideQuest.ticker > 4.25);
            const showRefreshTimer = sideQuest.data.complete && completionPhaseReady;
            if (showRefreshTimer !== sideQuest.timer.displayed) {
                sideQuest.timer.displayed = showRefreshTimer;
                sideQuest.elems.main.removeClass("pass-bg-pulse");
                sideQuest.elems.main.stop().animate(
                    {
                        opacity: 1,
                    },
                    250,
                );
                sideQuest.elems.info.css("display", showRefreshTimer ? "none" : "block");
                sideQuest.elems.timer.css("display", showRefreshTimer ? "block" : "none");
            }
            if (showRefreshTimer) {
                const refreshTimeRemainingMs = Math.max(
                    sideQuest.refreshTime - Date.now(),
                    0,
                );
                const refreshTimeText = humanizeTime(refreshTimeRemainingMs / 1000);
                if (refreshTimeText !== sideQuest.timer.str) {
                    sideQuest.timer.str = refreshTimeText;
                    sideQuest.elems.timer.html(refreshTimeText);
                }
            }
            if (
                !sideQuest.data.complete &&
                !sideQuest.refreshEnabled &&
                sideQuest.refreshTime <= Date.now()
            ) {
                sideQuest.refreshEnabled = true;
                sideQuest.elems.refresh.removeClass("pass-quest-refresh-disabled");
            }
        }
        this.pass.ticker += dt;
        if (this.pass.animSteps.length > 0 && this.pass.ticker >= 0) {
            const activeAnimStep = this.pass.animSteps[0];
            const passAnimT = math.clamp(this.pass.ticker / 1.5, 0, 1);
            this.pass.currentXp = math.lerp(
                math.easeOutExpo(passAnimT),
                activeAnimStep.startXp,
                activeAnimStep.targetXp,
            );
            this.pass.levelXp = activeAnimStep.levelXp;
            const passProgressPct =
                this.pass.currentLevel >= passUtil.getPassMaxLevel()
                    ? 100
                    : (this.pass.currentXp / activeAnimStep.levelXp) * 100;
            $("#pass-progress-xp-current").html(Math.round(this.pass.currentXp));
            $("#pass-progress-xp-target").html(this.pass.levelXp);
            $("#pass-progress-bar-fill").css({
                width: `${passProgressPct}%`,
            });
            this.updatePassTrackProgress(this.pass.currentLevel, this.pass.currentXp);
            if (passAnimT >= 1) {
                if (activeAnimStep.targetLevel > this.pass.currentLevel) {
                    this.pass.currentLevel = activeAnimStep.targetLevel;
                    this.animatePassLevelUp();
                }
                this.pass.animSteps.shift();
                this.pass.ticker -= 3;
            }
        }
        if (!this.account.loggingIn && !this.account.loggedIn && !this.lockDisplayed) {
            $("#pass-block").css("z-index", "1");
            $("#pass-loading").css("display", "none");
            $("#pass-locked").css("display", "block");
            this.lockDisplayed = true;
        }
    }

    onResize() {}
    loadPlaceholders() {
        const def = PassDefs[CurrentPassType];
        const passName = formatPassName(this.localization.translate(CurrentPassType));
        $("#pass-name-text").html(passName);
        $("#pass-progress-level").html(1);
        $("#pass-progress-xp-current").html(0);
        $("#pass-progress-xp-target").html(def.xp[0]);
        this.setPassUnlockImage(def.items[0] ?? null);
        $("#pass-items-wrapper").addClass("logged-out");
        this.populatePassItems();
    }
}
