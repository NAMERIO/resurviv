// "Game offline" / server upgrade screen.
// Shown by boot.ts when `gameOffline` is enabled in the server config (or the API is down).
// Styled after the start menu (menu-block, btn-green, #btn-help) so it matches the game.

const ALT_GAME_URL = "https://traprush.io";
const RECHECK_INTERVAL_S = 30;

const css = `
#offline-screen {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    overflow-y: auto;
    font-family: "Roboto Condensed", Arial, sans-serif;
    line-height: 20px;
    color: rgba(255, 255, 255, 0.8);
    background: #80af49 url(img/main_splash.png) center / cover no-repeat;
}
#offline-screen * { box-sizing: border-box; }
#offline-screen .os-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.3);
}
#offline-screen .os-main {
    position: relative;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
}
#offline-screen .os-logo {
    width: 396px;
    max-width: 100%;
    height: 140px;
    margin-bottom: 24px;
    background: url(img/resurviv_logo_full.png) center / contain no-repeat;
}
#offline-screen .os-menu {
    width: 340px;
    max-width: 100%;
    padding: 20px;
    background-color: rgba(0, 0, 0, 0.5);
    border-radius: 5px;
    text-align: center;
}
#offline-screen .os-title {
    margin: 0 0 8px;
    color: #fff;
    font-size: 24px;
    line-height: 28px;
    font-weight: 700;
    text-transform: uppercase;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
#offline-screen .os-text {
    margin: 0 0 16px;
    font-size: 16px;
}
#offline-screen .os-btn {
    display: block;
    width: 100%;
    height: 40px;
    line-height: 38px;
    margin-bottom: 8px;
    border: 0;
    border-radius: 5px;
    color: #fff;
    font-family: inherit;
    font-size: 16px;
    text-align: center;
    text-decoration: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    cursor: pointer;
}
#offline-screen .os-btn:hover,
#offline-screen .os-btn:active {
    filter: brightness(80%);
    transition: all 0.25s ease;
}
#offline-screen .os-btn-green {
    background: #83af50;
    border-bottom: 2px solid #5b7a38;
    box-shadow: inset 0 -2px #5b7a38;
    font-weight: 700;
}
#offline-screen .os-label {
    margin: 4px 0 8px;
    font-size: 14px;
}
@media (max-width: 850px), (max-height: 500px) {
    #offline-screen .os-logo { width: 264px; height: 94px; margin-bottom: 12px; }
    #offline-screen .os-menu { width: 260px; padding: 12px; }
    #offline-screen .os-title { font-size: 20px; line-height: 24px; }
    #offline-screen .os-text, #offline-screen .os-btn { font-size: 14px; }
    #offline-screen .os-btn { height: 34px; line-height: 32px; }
}
`;

const html = `
<div class="os-overlay"></div>
<div class="os-main">
    <div class="os-logo" role="img" aria-label="resurviv"></div>
    <div class="os-menu">
        <h1 class="os-title">Game Offline</h1>
        <p class="os-text">The servers are being upgraded. We'll be back soon!</p>
        <div class="os-label">Want to play something while you wait?</div>
        <a class="os-btn os-btn-green" href="${ALT_GAME_URL}" target="_blank" rel="noopener">Play TrapRush.io</a>
    </div>
</div>
`;

export function showOfflineScreen(checkStatus: () => Promise<"online" | "offline">) {
    document.title = "resurviv - Offline";

    // Wipe the whole game page so nothing of it is left to interact with
    document.body.replaceChildren();

    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    const root = document.createElement("div");
    root.id = "offline-screen";
    root.innerHTML = html;
    document.body.appendChild(root);
    document.documentElement.classList.remove("boot-pending");

    // Silently re-check in the background, reload once the game is back online
    const check = async () => {
        if ((await checkStatus()) === "online") {
            window.location.reload();
            return;
        }
        setTimeout(check, RECHECK_INTERVAL_S * 1000);
    };
    setTimeout(check, RECHECK_INTERVAL_S * 1000);
}
