import $ from "jquery";
import { type MapDef, MapDefs } from "../../shared/defs/mapDefs";
import { TeamModeToString } from "../../shared/defs/types/misc";
import type { SiteInfoRes } from "../../shared/types/api";
import { api } from "./api";
import type { ConfigManager } from "./config";
import { device } from "./device";
import type { Localization } from "./ui/localization";

export class SiteInfo {
    info: SiteInfoRes = {} as SiteInfoRes;
    loaded = false;

    constructor(
        public config: ConfigManager,
        public localization: Localization,
    ) {
        this.config = config;
        this.localization = localization;
    }

    load() {
        const locale = this.localization.getLocale();
        const siteInfoUrl = api.resolveUrl(`/api/site_info?language=${locale}`);

        const mainSelector = $("#server-opts");
        const teamSelector = $("#team-server-opts");

        for (const region in GAME_REGIONS) {
            const data = GAME_REGIONS[region];
            const name = this.localization.translate(data.l10n);
            const elm = `<option value='${region}' data-l10n='${data.l10n}' data-label='${name}'>${name}</option>`;
            mainSelector.append(elm);
            teamSelector.append(elm);
        }

        $.ajax(siteInfoUrl).done((data, _status) => {
            this.info = data || {};
            this.loaded = true;
            this.updatePageFromInfo();
        });
    }

    getGameModeStyles() {
        const availableModes = [];
        const modes = this.info.modes || [];
        for (let i = 0; i < modes.length; i++) {
            const mode = modes[i];
            const mapDesc = this.getMapButtonDesc(mode.mapName);
            const buttonText = mapDesc.buttonText
                ? mapDesc.buttonText
                : TeamModeToString[mode.teamMode];
            availableModes.push({
                icon: mapDesc.icon,
                buttonCss: mapDesc.buttonCss,
                buttonText,
                enabled: mode.enabled,
            });
        }
        return availableModes;
    }

    getBaseMapName(mapName: string) {
        return mapName.startsWith("br_") ? mapName.slice(3) : mapName;
    }

    getMapButtonDesc(mapName: string) {
        const mapDef = MapDefs[mapName as keyof typeof MapDefs] || MapDefs.main;
        const fallbackDef =
            MapDefs[this.getBaseMapName(mapName) as keyof typeof MapDefs] || MapDefs.main;

        return {
            ...fallbackDef.desc,
            ...mapDef.desc,
            icon: mapDef.desc.icon || fallbackDef.desc.icon,
            buttonCss: mapDef.desc.buttonCss || fallbackDef.desc.buttonCss,
            buttonText: mapDef.desc.buttonText || fallbackDef.desc.buttonText,
        };
    }

    getModeLabel(mapName: string, _teamMode: number) {
        const isBattleRoyale = mapName.startsWith("br_");
        return isBattleRoyale ? "Battle Royale" : "Deathmatch";
    }

    applyQuickPlayButtonStyle(
        modeIdx: number,
        gameModeStyles = this.getGameModeStyles(),
    ) {
        const btn = $("#btn-start-mode-0");
        const mode = this.info.modes?.[modeIdx];
        const style = gameModeStyles[modeIdx];
        const teamModeText = mode
            ? TeamModeToString[mode.teamMode as keyof typeof TeamModeToString]
            : undefined;
        const playL10n = teamModeText ? `index-play-${teamModeText}` : "index-play";
        btn.removeClass("btn-custom-mode-no-indent btn-custom-mode-main");
        btn.removeClass((_idx, className) => {
            return (className.match(/\bbtn-mode-[^\s]+/g) || []).join(" ");
        });
        btn.css("background-image", "");
        btn.data("l10n", playL10n);
        btn.html(this.localization.translate(playL10n));

        if (style?.icon || style?.buttonCss) {
            btn.addClass("btn-custom-mode-no-indent");
            btn.addClass(style.buttonCss);
            btn.css({
                "background-image": style.icon ? `url(${style.icon})` : "",
            });
        }
    }

    updatePageFromInfo() {
        if (this.loaded) {
            const getGameModeStyles = this.getGameModeStyles();
            const modeSelector = $("#game-mode-select-main");
            modeSelector.empty();
            for (let i = 0; i < getGameModeStyles.length; i++) {
                const style = getGameModeStyles[i];
                const mode = this.info.modes[i];
                if (mode?.enabled) {
                    modeSelector.append(
                        $("<option>", {
                            value: String(i),
                            text: this.getModeLabel(mode.mapName, mode.teamMode),
                        }),
                    );
                }
                const selector = `index-play-${style.buttonText}`;
                const btn = $(`#btn-start-mode-${i}`);
                if (i === 0) {
                    continue;
                }
                btn.data("l10n", selector);
                btn.html(this.localization.translate(selector));
                if (style.icon || style.buttonCss) {
                    if (i == 0) {
                        btn.addClass("btn-custom-mode-no-indent");
                    } else {
                        btn.addClass("btn-custom-mode-main");
                    }
                    btn.addClass(style.buttonCss);
                    btn.css({
                        "background-image": `url(${style.icon})`,
                    });
                }
                const l = $(`#btn-team-queue-mode-${i}`);
                if (l.length) {
                    const c = `index-${style.buttonText}`;
                    l.data("l10n", c);
                    l.html(this.localization.translate(c));
                    if (style.icon) {
                        l.addClass("btn-custom-mode-select");
                        l.css({
                            "background-image": `url(${style.icon})`,
                        });
                    }
                }

                btn.toggle(style.enabled);
            }
            if (modeSelector.children().length) {
                const configuredMode = String(this.config.get("gameModeIdx"));
                const configuredOption = modeSelector.children(
                    `option[value="${configuredMode}"]`,
                );
                const selectedMode = configuredOption.length
                    ? configuredMode
                    : String(modeSelector.children().first().val() ?? "0");
                modeSelector.val(selectedMode);
                this.applyQuickPlayButtonStyle(Number(selectedMode), getGameModeStyles);
                $("#btn-start-mode-0").toggle(true);
            } else {
                $("#btn-start-mode-0").toggle(false);
            }
            modeSelector.off("change.siteInfo").on("change.siteInfo", () => {
                const selectedMode = Number(modeSelector.val());
                if (Number.isFinite(selectedMode)) {
                    this.config.set("gameModeIdx", selectedMode);
                    this.applyQuickPlayButtonStyle(selectedMode, getGameModeStyles);
                }
            });
            const supportsTeam = this.info.modes.some((s) => s.enabled && s.teamMode > 1);
            $("#btn-join-team, #btn-create-team").toggle(supportsTeam);

            const supportsPrivateLobby = this.info.modes.length > 0;
            $("#btn-prestige-arena, #open-arena-button").toggle(supportsPrivateLobby);

            // Region pops
            const pops = this.info.pops;
            if (pops) {
                const regions = Object.keys(pops);

                for (let i = 0; i < regions.length; i++) {
                    const region = regions[i];
                    const data = pops[region];
                    const sel = $("#server-opts").children(`option[value="${region}"]`);
                    const players = this.localization.translate("index-players");
                    sel.text(`${sel.data("label")} [${data.playerCount} ${players}]`);
                }
            }
            let hasTwitchStreamers = false;
            const featuredStreamersElem = $("#featured-streamers");
            const streamerList = $(".streamer-list");
            if (!device.mobile && this.info.twitch) {
                streamerList.empty();
                for (let i = 0; i < this.info.twitch.length; i++) {
                    const streamer = this.info.twitch[i];
                    const template = $("#featured-streamer-template").clone();
                    template
                        .attr("class", "featured-streamer streamer-tooltip")
                        .attr("id", "");
                    const link = template.find("a");
                    const text = this.localization.translate(
                        streamer.viewers == 1 ? "index-viewer" : "index-viewers",
                    );
                    link.html(
                        `${streamer.name} <span>${streamer.viewers} ${text}</span>`,
                    );
                    link.css("background-image", `url(${streamer.img})`);
                    link.attr("href", streamer.url);
                    streamerList.append(template);
                    hasTwitchStreamers = true;
                }
            }
            featuredStreamersElem.css(
                "visibility",
                hasTwitchStreamers ? "visible" : "hidden",
            );

            const featuredYoutuberElem = $("#featured-youtuber");
            const displayYoutuber = this.info.youtube;
            if (displayYoutuber) {
                $(".btn-youtuber")
                    .attr("href", this.info.youtube.link)
                    .html(this.info.youtube.name);
            }
            featuredYoutuberElem.css("display", displayYoutuber ? "block" : "none");

            const mapDef = MapDefs[this.info.clientTheme] as MapDef;
            if (mapDef) {
                this.config.set("cachedBgImg", mapDef.desc.backgroundImg);
                const bg = document.getElementById("background");
                if (bg) {
                    bg.style.backgroundImage = `url(${mapDef.desc.backgroundImg})`;
                }
            }
        }
    }
}
