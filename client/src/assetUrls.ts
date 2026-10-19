export function getVersionedImageUrl(path: string): string {
    const revision = typeof GIT_VERSION === "undefined" ? undefined : GIT_VERSION;
    if (!path || !revision || path.startsWith("data:") || path.startsWith("blob:")) {
        return path;
    }
    const hashIndex = path.indexOf("#");
    const url = hashIndex === -1 ? path : path.slice(0, hashIndex);
    const fragment = hashIndex === -1 ? "" : path.slice(hashIndex);
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${encodeURIComponent(revision)}${fragment}`;
}
