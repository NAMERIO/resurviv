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

        if (region && region !== this.currentServer) {
            this.currentServer = region;
            this.resetPing();

            const servers = [
                { region: "NA", url: "resurviv.biz" },
                { region: "EU", url: "217.160.224.171" },
            ];

            const selectedServer = servers.find(
                (server) => region.toUpperCase() === server.region.toUpperCase(),
            );

            if (selectedServer) {
                this.pingTest = new PingTest(selectedServer);
                this.pingTest.startPingTest();
            } else {
                this.resetPing();
            }
        }
    }

    resetPing() {
        if (this.pingTest && this.pingTest.test.ws) {
            this.pingTest.test.ws.close();
            this.pingTest.test.ws = null;
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
                let border = "#FFFFFF";

                switch (weaponName.toUpperCase()) {
                    //yellow
                    case "CZ-3A1":
                    case "G18C":
                    case "M9":
                    case "M93R":
                    case "MAC-10":
                    case "MP5":
                    case "P30L":
                    case "DUAL P30L":
                    case "UMP9":
                    case "VECTOR":
                    case "VSS":
                    case "FLAMETHROWER":
                        border = "#FFAE00";
                        break;
                    //blue
                    case "AK-47":
                    case "OT-38":
                    case "OTS-38":
                    case "M39 EMR":
                    case "DP-28":
                    case "MOSIN-NAGANT":
                    case "SCAR-H":
                    case "SV-98":
                    case "M1 GARAND":
                    case "PKP PECHENEG":
                    case "AN-94":
                    case "BAR M1918":
                    case "BLR 81":
                    case "SVD-63":
                    case "M134":
                    case "GROZA":
                    case "GROZA-S":
                        border = "#007FFF";
                        break;
                    //green
                    case "FAMAS":
                    case "M416":
                    case "M249":
                    case "QBB-97":
                    case "MK 12 SPR":
                    case "M4A1-S":
                    case "SCOUT ELITE":
                    case "L86A2":
                        border = "#0f690d";
                        break;
                    //red
                    case "M870":
                    case "MP220":
                    case "SAIGA-12":
                    case "SPAS-12":
                    case "USAS-12":
                    case "SUPER 90":
                    case "LASR GUN":
                    case "M1100":
                        border = "#FF0000";
                        break;
                    //purple
                    case "MODEL 94":
                    case "PEACEMAKER":
                    case "VECTOR (.45 ACP)":
                    case "M1911":
                    case "M1A1":
                        border = "#800080";
                        break;
                    //black
                    case "DEAGLE 50":
                    case "RAINBOW BLASTER":
                        border = "#000000";
                        break;
                    //olive
                    case "AWM-S":
                    case "MK 20 SSR":
                        border = "#808000";
                        break;
                    //brown
                    case "POTATO CANNON":
                    case "SPUD GUN":
                        border = "#A52A2A";
                        break;
                    //other Guns
                    case "FLARE GUN":
                        border = "#FF4500";
                        break;
                    case "M79":
                        border = "#008080";
                        break;
                    case "HEART CANNON":
                        border = "#FFC0CB";
                        break;
                    default:
                        border = "#FFFFFF";
                        break;
                }

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

        this.frameCount++;

        if (delta >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / delta);
            this.frameCount = 0;
            this.lastFrameTime = now;

            if (this.isFpsVisible && this.fpsCounter) {
                this.fpsCounter.textContent = `FPS: ${this.fps}`;
            }
        }
        if (this.pingCounter && this.isPingVisible) {
            const pingRes = this.pingTest?.getPingResult();
            const pingValue = typeof pingRes?.ping === "number" ? pingRes.ping : "N/A";
            this.pingCounter.textContent = `Ping: ${pingValue} ms`;
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

export class PingTest {
    ptcDataBuf: ArrayBuffer;
    test: {
        region: string;
        url: string;
        ping: number | string;
        ws: WebSocket | null;
        sendTime: number;
        retryCount: number;
    };

    constructor(selectedServer: { region: string; url: string }) {
        this.ptcDataBuf = new ArrayBuffer(1);
        this.test = {
            region: selectedServer.region,
            url: `wss://${selectedServer.url}/ptc`,
            ping: 9999,
            ws: null,
            sendTime: 0,
            retryCount: 0,
        };
    }

    startPingTest() {
        if (!this.test.ws) {
            const ws = new WebSocket(this.test.url);
            ws.binaryType = "arraybuffer";

            ws.onopen = () => {
                this.sendPing();
                this.test.retryCount = 0;
            };

            ws.onmessage = () => {
                const elapsed = (Date.now() - this.test.sendTime) / 1e3;
                this.test.ping = Math.round(elapsed * 1000);
                this.test.retryCount = 0;
                setTimeout(() => this.sendPing(), 200);
            };

            ws.onerror = () => {
                this.test.ping = "Error";
                this.test.retryCount++;
                if (this.test.retryCount < 5) {
                    setTimeout(() => this.startPingTest(), 2000);
                } else {
                    this.test.ws = null;
                }
            };

            ws.onclose = () => {
                this.test.ws = null;
            };

            this.test.ws = ws;
        }
    }

    sendPing() {
        if (this.test.ws && this.test.ws.readyState === WebSocket.OPEN) {
            this.test.sendTime = Date.now();
            this.test.ws.send(this.ptcDataBuf);
        }
    }

    getPingResult() {
        return {
            region: this.test.region,
            ping: this.test.ping,
        };
    }
}
