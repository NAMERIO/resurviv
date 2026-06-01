/// <reference types="vite/client" />

declare module "*.ejs" {
    function render(env: Record<string, any>);
    export default render;
}

interface ImportMetaEnv {
    readonly VITE_ENABLE_SURVEV_ADS: boolean;
    readonly VITE_H5_GAMES_ADS_ENABLED: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare module "virtual-atlases-*" {}
