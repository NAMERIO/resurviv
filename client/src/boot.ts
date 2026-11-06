import { api } from "./api";

type ServerStatus = "online" | "offline";

async function getServerStatus(): Promise<ServerStatus> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const res = await fetch(api.resolveUrl("/api/server_status"), {
            cache: "no-store",
            signal: controller.signal,
        });
        if (res.ok) {
            const data = (await res.json()) as { offline?: boolean };
            return data.offline ? "offline" : "online";
        }
        if (res.status === 502 || res.status === 503 || res.status === 504) {
            return "offline";
        }
    } catch {
    } finally {
        clearTimeout(timeout);
    }
    return "online";
}

async function boot() {
    const status = await getServerStatus();
    if (status === "offline") {
        const { showOfflineScreen } = await import("./offlineScreen");
        showOfflineScreen(getServerStatus);
        return;
    }
    document.documentElement.classList.remove("boot-pending");
    await import("./main");
}

void boot();
