import fs from "node:fs";
import esbuild, { type BuildOptions, type Plugin } from "esbuild";
import { pluginDir, readDirectory } from "./game/pluginManager";

if (fs.existsSync("./dist")) {
    fs.rmSync("./dist", { recursive: true });
}

const stripFromProdServer: Plugin = {
    name: "strip-from-prod-server",
    setup(build) {
        build.onLoad({ filter: /\.ts$/ }, (args) => {
            const source = fs.readFileSync(args.path, "utf8");
            if (!source.includes("STRIP_FROM_PROD_SERVER:START")) return undefined;
            return {
                contents: source.replace(
                    /\/\* STRIP_FROM_PROD_SERVER:START \*\/[\s\S]*?\/\* STRIP_FROM_PROD_SERVER:END \*\//g,
                    "",
                ),
                loader: "ts",
            };
        });
    },
};

const esbuildConfig: BuildOptions = {
    bundle: true,
    minify: false,
    minifySyntax: true,
    outdir: "./dist",
    platform: "node",
    packages: "external",
    entryNames: "[name]",
    sourcemap: "linked",
    logLevel: "info",
    format: "esm",
    define: {
        "process.env.NODE_ENV": "'production'",
    },
    plugins: [stripFromProdServer],
};

async function main() {
    await esbuild.build({
        ...esbuildConfig,
        entryPoints: [
            "./src/gameServer.ts",
            "./src/game/gameProcess.ts",
            "./src/api/index.ts",
        ],
    });

    fs.copyFileSync(
        "./src/api/competitive/LICENSE-StarCubey",
        "./dist/LICENSE-StarCubey",
    );

    if (fs.existsSync(pluginDir)) {
        const pluginPaths = readDirectory(pluginDir);

        await esbuild.build({
            ...esbuildConfig,
            outdir: "./dist/plugins",
            entryPoints: pluginPaths,
        });
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
