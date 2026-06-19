import { GunDefs } from "../../shared/defs/gameObjects/gunDefs";
import { PingTest } from "./pingTest";

const ammoBorderColors: Record<string, string> = {
    "9mm": "#FFAE00",
    "762mm": "#007FFF",
    "556mm": "#0f690d",
    "12gauge": "#FF0000",
    "45acp": "#800080",
    "50AE": "#000000",
    "308sub": "#808000",
    potato_ammo: "#945400ff",
    flare: "#FF4500",
    "40mm": "#008080",
    heart_ammo: "#FFC0CB",
    "9mm_cursed": "#130900",
    flux_rifle_ammo: "#00FFFF",
    snow_ammo: "#A7D8FF",
    rainbow_ammo: "#000000",
    bugle_ammo: "#FFFFFF",
};

const weaponBorderColors = new Map<string, string>();
for (const def of Object.values(GunDefs)) {
    const color = ammoBorderColors[def.ammo];
    if (color) {
        const weaponName = def.name.toUpperCase();
        if (!weaponBorderColors.has(weaponName)) {
            weaponBorderColors.set(weaponName, color);
        }
    }
}

weaponBorderColors.set("VECTOR (.45 ACP)", ammoBorderColors["45acp"]);

export class GameMod {
    lastFrameTime: number;
    frameCount: number;
    fps: number;
    isLocalRotation: boolean;
    isFpsUncapped: boolean;
    isInterpolation: boolean;
    isFpsVisible: boolean;
    isPingVisible: boolean;
    fpsCounter!: HTMLElement | null;
    killsCounter!: HTMLElement | null;
    pingCounter!: HTMLElement | null;
    localRotation!: HTMLElement | null;
    currentServer!: string | null;
    pingTest!: PingTest | null;
    pingDisplayTimer: number;
    lastPingValue: number | null;
    private hasInitialized: boolean = false;
    animationFrameCallback: (callback: () => void) => void;

    constructor() {
        const settings = JSON.parse(localStorage.getItem("gameSettings") || "{}");
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.fps = 0;
        this.isLocalRotation =
            settings["local-rotation"] !== undefined ? settings["local-rotation"] : true;
        this.isFpsUncapped =
            settings["fps-uncap"] !== undefined ? settings["fps-uncap"] : false;
        this.isInterpolation =
            settings["movement-interpolation"] !== undefined
                ? settings["movement-interpolation"]
                : true;
        this.isFpsVisible = true;
        this.isPingVisible = true;
        this.pingDisplayTimer = 0;
        this.lastPingValue = null;

        this.animationFrameCallback = (callback: () => void) => setTimeout(callback, 1);
        this.SettingsCheck();

        this.initFpsCounter();
        this.startUpdateLoop();
        this.setupWeaponBorderHandler();
    }

    initFpsCounter() {
        if (document.getElementById("fpsCounter")) return;
        this.fpsCounter = document.createElement("div");
        this.fpsCounter.id = "fpsCounter";
        Object.assign(this.fpsCounter.style, {
            color: "white",
            backgroundColor: "rgba(0, 0, 0, 0.2)",
            padding: "5px 10px",
            marginTop: "10px",
            borderRadius: "5px",
            fontFamily: "Arial, sans-serif",
            fontSize: "14px",
            zIndex: "10000",
            pointerEvents: "none",
        });

        this.pingCounter = document.createElement("div");
        this.pingCounter.id = "pingCounter";
        Object.assign(this.pingCounter.style, {
            color: "white",
            backgroundColor: "rgba(0, 0, 0, 0.2)",
            padding: "5px 10px",
            marginTop: "2px",
            borderRadius: "5px",
            fontFamily: "Arial, sans-serif",
            fontSize: "14px",
            zIndex: "10000",
            pointerEvents: "none",
        });

        const uiTopLeft = document.getElementById("ui-top-left");
        if (uiTopLeft) {
            uiTopLeft.appendChild(this.fpsCounter);
            uiTopLeft.appendChild(this.pingCounter);
        }

        this.updateFpsVisibility();
        this.updatePingVisibility();
    }
    updatePingVisibility() {
        if (this.pingCounter) {
            this.pingCounter.style.display = this.isPingVisible ? "block" : "none";
            this.pingCounter.style.backgroundColor = this.isPingVisible
                ? "rgba(0, 0, 0, 0.2)"
                : "transparent";
        }
    }

    updateFpsVisibility() {
        if (this.fpsCounter) {
            this.fpsCounter.style.display = this.isFpsVisible ? "block" : "none";
            this.fpsCounter.style.backgroundColor = this.isFpsVisible
                ? "rgba(0, 0, 0, 0.2)"
                : "transparent";
        }
    }

    updateFpsToggle() {
        if (this.isFpsUncapped) {
            this.animationFrameCallback = (callback: () => void) =>
                setTimeout(callback, 1);
        } else {
            this.animationFrameCallback = (callback: () => void) =>
                requestAnimationFrame(callback);
        }
    }

    getRegionFromLocalStorage(): string | null {
        let config = localStorage.getItem("surviv_config");
        if (config) {
            let configObject = JSON.parse(config);
            return configObject.region;
        }
        return null;
    }

    startPingTest() {
        const currentUrl = window.location.href;
        const isSpecialUrl = /\/#\w+/.test(currentUrl);

        const teamSelectElement = document.getElementById(
            "team-server-select",
        ) as HTMLSelectElement | null;
        const mainSelectElement = document.getElementById(
            "server-select-main",
        ) as HTMLSelectElement | null;

        const region =
            isSpecialUrl && teamSelectElement
                ? teamSelectElement.value || teamSelectElement.getAttribute("value")
                : mainSelectElement
                  ? mainSelectElement.value || mainSelectElement.getAttribute("value")
                  : null;

        const shouldRestartPing =
            !!region && (region !== this.currentServer || !this.pingTest);

        if (shouldRestartPing && region) {
            this.currentServer = region;
            this.resetPing();
            this.pingTest = new PingTest();
            this.pingTest.start([region]);
        }
    }

    resetPing() {
        if (this.pingTest) {
            for (const test of this.pingTest.tests) {
                if (test.ws) {
                    test.ws.close();
                    test.ws = null;
                }
            }
        }
        this.pingTest = null;
    }

    updateHealthBars() {
        const healthBars = document.querySelectorAll("#ui-health-container");
        healthBars.forEach((container) => {
            const bar = container.querySelector("#ui-health-actual") as HTMLElement;
            if (bar) {
                const width = Math.round(parseFloat(bar.style.width));
                let percentageText = container.querySelector(
                    ".health-text",
                ) as HTMLElement;

                if (!percentageText) {
                    percentageText = document.createElement("span");
                    percentageText.classList.add("health-text");
                    Object.assign(percentageText.style, {
                        width: "100%",
                        textAlign: "center",
                        marginTop: "5px",
                        color: "#333",
                        fontSize: "20px",
                        fontWeight: "bold",
                        position: "absolute",
                        zIndex: "10",
                    });
                    container.appendChild(percentageText);
                }

                percentageText.textContent = `${width}%`;
            }
        });
    }

    updateBoostBars(): void {
        const boostCounter = document.querySelector(
            "#ui-boost-counter",
        ) as HTMLElement | null;
        if (boostCounter) {
            const boostBars = boostCounter.querySelectorAll<HTMLDivElement>(
                ".ui-boost-base .ui-bar-inner",
            );

            let totalBoost = 0;
            const weights: number[] = [25, 25, 40, 10];

            boostBars.forEach((bar, index) => {
                const width = parseFloat(bar.style.width);
                if (!isNaN(width)) {
                    totalBoost += width * (weights[index] / 100);
                }
            });

            const averageBoost = Math.round(totalBoost);
            let boostDisplay = boostCounter.querySelector(
                ".boost-display",
            ) as HTMLDivElement | null;

            if (!boostDisplay) {
                boostDisplay = document.createElement("div");
                boostDisplay.classList.add("boost-display");
                Object.assign(boostDisplay.style, {
                    position: "absolute",
                    bottom: "75px",
                    right: "335px",
                    color: "#FF901A",
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    padding: "5px 10px",
                    borderRadius: "5px",
                    fontFamily: "Arial, sans-serif",
                    fontSize: "14px",
                    zIndex: "10",
                    textAlign: "center",
                });

                boostCounter.appendChild(boostDisplay);
            }

            boostDisplay.textContent = `AD: ${averageBoost}%`;
        }
    }

    setupWeaponBorderHandler() {
        const weaponContainers = Array.from(
            document.getElementsByClassName("ui-weapon-switch"),
        ) as HTMLElement[];
        weaponContainers.forEach((container) => {
            if (container.id === "ui-weapon-id-4") {
                container.style.border = "3px solid #2f4032";
            } else {
                container.style.border = "3px solid #FFFFFF";
            }
        });

        const weaponNames = Array.from(
            document.getElementsByClassName("ui-weapon-name"),
        ) as HTMLElement[];
        weaponNames.forEach((weaponNameElement) => {
            const weaponContainer = weaponNameElement.closest(
                ".ui-weapon-switch",
            ) as HTMLElement;
            const observer = new MutationObserver(() => {
                const weaponName = weaponNameElement.textContent?.trim() || "";
                const border =
                    weaponBorderColors.get(weaponName.toUpperCase()) ?? "#FFFFFF";

                if (weaponContainer.id !== "ui-weapon-id-4") {
                    weaponContainer.style.border = `3px solid ${border}`;
                }
            });

            observer.observe(weaponNameElement, {
                childList: true,
                characterData: true,
                subtree: true,
            });
        });
    }

    updateUiElements() {
        const currentUrl = window.location.href;

        const isSpecialUrl = /\/#\w+/.test(currentUrl);

        const playerOptions = document.getElementById("player-options");
        const teamMenuContents = document.getElementById("team-menu-options");
        const startMenuContainer = document.querySelector(
            "#start-menu .play-button-container",
        );

        if (!playerOptions) return;

        if (
            isSpecialUrl &&
            teamMenuContents &&
            playerOptions.parentNode !== teamMenuContents
        ) {
            teamMenuContents.appendChild(playerOptions);
        } else if (
            !isSpecialUrl &&
            startMenuContainer &&
            playerOptions.parentNode !== startMenuContainer
        ) {
            const firstChild = startMenuContainer.firstChild;
            startMenuContainer.insertBefore(playerOptions, firstChild);
        }
    }

    SettingsCheck() {
        if (this.hasInitialized) return;
        this.hasInitialized = true;

        const boxRotation = document.querySelector("#modal-settings-local-rotation");
        if (boxRotation) {
            const localRotationCheckbox = document.querySelector("#local-rotation");
            if (localRotationCheckbox) {
                localRotationCheckbox.addEventListener("change", (event) => {
                    this.isLocalRotation = (event.target as HTMLInputElement).checked;
                    this.saveLocalStorage();
                });
            }
        }

        const boxUncap = document.querySelector("#modal-settings-fps-uncap");
        if (boxUncap) {
            const fpsUncap = document.querySelector("#fps-uncap");
            if (fpsUncap) {
                fpsUncap.addEventListener("change", (event) => {
                    this.isFpsUncapped = (event.target as HTMLInputElement).checked;
                    this.saveLocalStorage();
                });
            }
        }

        const boxInterpolation = document.querySelector("#modal-settings-interpolation");
        if (boxInterpolation) {
            const interpolation = document.querySelector("#movement-interpolation");
            if (interpolation) {
                interpolation.addEventListener("change", (event) => {
                    this.isInterpolation = (event.target as HTMLInputElement).checked;
                    this.saveLocalStorage();
                });
            }
        }
    }

    saveLocalStorage() {
        const settings = {
            "local-rotation": this.isLocalRotation,
            "fps-uncap": this.isFpsUncapped,
            "movement-interpolation": this.isInterpolation,
        };
        localStorage.setItem("gameSettings", JSON.stringify(settings));
    }

    startUpdateLoop() {
        const now = performance.now();
        const delta = now - this.lastFrameTime;
        const dt = Math.min(Math.max(delta / 1000, 0.001), 1 / 8);

        this.frameCount++;

        if (delta >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / delta);
            this.frameCount = 0;
            this.lastFrameTime = now;

            if (this.isFpsVisible && this.fpsCounter) {
                this.fpsCounter.textContent = `FPS: ${this.fps}`;
            }
        }
        this.pingTest?.update(dt);
        this.pingDisplayTimer -= dt;
        if (this.pingCounter && this.isPingVisible && this.pingDisplayTimer <= 0) {
            const pingRes = this.pingTest?.getPingResult(this.currentServer ?? undefined);
            if (typeof pingRes?.ping === "number") {
                this.lastPingValue = pingRes.ping;
            }
            const pingValue = this.lastPingValue ?? "N/A";
            this.pingCounter.textContent = `Ping: ${pingValue} ms`;
            this.pingDisplayTimer = 3;
        }

        this.startPingTest();
        this.animationFrameCallback(() => this.startUpdateLoop());
        this.updateUiElements();
        this.updateBoostBars();
        this.updateHealthBars();
        this.updateFpsToggle();
        this.SettingsCheck();
    }
}
