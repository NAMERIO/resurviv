import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const task = process.argv[2];
if (!["bundleRelease", "assembleDebug"].includes(task))
    throw new Error("Invalid Gradle task");
const windows = process.platform === "win32";
const result = spawnSync(
    windows ? "cmd.exe" : "./gradlew",
    windows ? ["/d", "/c", "gradlew.bat", task] : [task],
    {
        cwd: fileURLToPath(new URL("../android/", import.meta.url)),
        stdio: "inherit",
    },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
