import { createHash, createHmac } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { Config } from "../config";

const REGION = "auto";
const SERVICE = "s3";

function credentials() {
    const accessKeyId = Config.secrets.REPLAY_STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = Config.secrets.REPLAY_STORAGE_SECRET_ACCESS_KEY;
    if (
        !Config.replays.enabled ||
        !Config.replays.endpoint ||
        !Config.replays.bucket ||
        !accessKeyId ||
        !secretAccessKey
    ) {
        return undefined;
    }
    return { accessKeyId, secretAccessKey };
}

export function replayStorageEnabled() {
    return credentials() !== undefined;
}

function sha256(value: string | Uint8Array) {
    return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string) {
    return createHmac("sha256", key).update(value).digest();
}

function encodePath(value: string) {
    return value
        .split("/")
        .map((part) =>
            encodeURIComponent(part).replace(
                /[!'()*]/g,
                (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
            ),
        )
        .join("/");
}

async function request(method: "GET" | "PUT" | "DELETE", key: string, body?: Buffer) {
    const auth = credentials();
    if (!auth) throw new Error("Replay object storage is not configured");

    const endpoint = new URL(Config.replays.endpoint);
    const canonicalUri = `/${encodePath(Config.replays.bucket)}/${encodePath(key)}`;
    const url = new URL(canonicalUri, endpoint);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = amzDate.slice(0, 8);
    const payloadHash = sha256(body ?? new Uint8Array());
    const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
        method,
        canonicalUri,
        "",
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join("\n");
    const scope = `${date}/${REGION}/${SERVICE}/aws4_request`;
    const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        scope,
        sha256(canonicalRequest),
    ].join("\n");
    const dateKey = hmac(`AWS4${auth.secretAccessKey}`, date);
    const regionKey = hmac(dateKey, REGION);
    const serviceKey = hmac(regionKey, SERVICE);
    const signingKey = hmac(serviceKey, "aws4_request");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

    const response = await fetch(url, {
        method,
        headers: {
            authorization: `AWS4-HMAC-SHA256 Credential=${auth.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
            "x-amz-content-sha256": payloadHash,
            "x-amz-date": amzDate,
            ...(method === "PUT" ? { "content-type": "application/gzip" } : {}),
        },
        body: method === "PUT" && body ? new Uint8Array(body) : undefined,
    });
    if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        throw new Error(
            `Replay storage ${method} failed (${response.status}): ${detail}`,
        );
    }
    return response;
}

export async function storeReplayObject(gameId: string, replay: Uint8Array) {
    const objectKey = `arena/${gameId}.surv.gz`;
    const compressed = gzipSync(replay, { level: 9 });
    await request("PUT", objectKey, compressed);
    return {
        objectKey,
        sizeBytes: replay.byteLength,
        compressedSizeBytes: compressed.byteLength,
    };
}

export async function loadReplayObject(objectKey: string) {
    const response = await request("GET", objectKey);
    const compressed = Buffer.from(await response.arrayBuffer());
    return gunzipSync(compressed);
}

export async function deleteReplayObject(objectKey: string) {
    await request("DELETE", objectKey);
}
