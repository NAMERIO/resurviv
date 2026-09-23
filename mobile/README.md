# Resurviv for Android

This is a Capacitor container for the existing Vite client, not a separate frontend.
Application ID: `biz.resurviv.app`. App name: **Resurviv**.
`capacitor.config.ts` copies `../client/dist`, the output of the existing client production
build. Native Android sources live in `mobile/android`; web assets and generated build
products are ignored by Git. Normal web/server development and deployment stay unchanged.

## Build and open

Install Node 22+, pnpm 10.31.0, Android Studio, **JDK 21**, Android SDK Platform 36 and
Build Tools 36. Set `JAVA_HOME` to JDK 21 and `ANDROID_HOME` to your SDK, or configure
Gradle JDK and SDK location in Android Studio. A newer Studio may bundle Java 25;
select JDK 21 explicitly for this project's Gradle 8.14.3 wrapper.
See the [Capacitor setup guide](https://capacitorjs.com/docs/getting-started/environment-setup).

Run from the repository root:

```sh
pnpm install
pnpm build:client       # existing production client: typecheck + Vite build
pnpm android:sync       # rebuild client, copy it, sync native plugins
pnpm android:open       # open mobile/android in Android Studio
pnpm android:apk        # rebuild/sync, then assembleDebug
pnpm android:bundle     # rebuild/sync, then bundleRelease (unsigned)
```

The Android project is already checked in. `pnpm android:add` is only for initially
generating a missing project; `pnpm android:update` updates native dependencies after
changing Capacitor/plugin versions. Use `android:sync` for ordinary changes. Keep
reviewed changes to MainActivity, the manifest, theme, and release settings when
regenerating a native project.

Outputs:

- Debug APK: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`
- Unsigned AAB: `mobile/android/app/build/outputs/bundle/release/app-release.aab`

## Required production server deployment

Deploy the matching server changes **before testing the app against production**:

1. Apply the normal database migrations (`pnpm --filter @survev/server db:migrate`, or
   your existing migration procedure). Migration `0042_native_auth.sql` creates the
   short-lived OAuth handoff table. Do not run migrations against a production database
   without following the deployment procedure for that database.
2. Serve `/api/mobile/config` and `/api/auth/native/{request,exchange}` from
   `https://resurviv.biz`. The first endpoint exposes only public region addresses,
   localization labels and login availability. Regions are obtained at app startup,
   so an Android build does not depend on a developer's local region configuration.
3. Configure production regions with publicly reachable TLS addresses and `https: true`.
   Ping tests use WSS, matchmaking must return `useHttps: true`, and lobby connections
   use `wss://resurviv.biz/team_v2`. No cleartext fallback is enabled.
4. Preserve credentialed CORS for the exact origin `https://app.resurviv.biz`, including
   OPTIONS, `Content-Type`, and `X-Requested-With`. The API now handles that origin;
   reverse proxies/CDNs must not replace its response with `Access-Control-Allow-Origin: *`
   when credentials are used. Return `Vary: Origin` normally (Hono's CORS middleware does this).
5. Keep `oauthRedirectURI` set to the production HTTPS origin and the normal production
   `oauthBasePath`/cookie-domain configuration. Preserve secure HttpOnly session cookies.
   If Turnstile is enabled, permit `app.resurviv.biz` in its public site-key domain settings
   and build with the same public Turnstile configuration used by the production web client.

`https://app.resurviv.biz` is Capacitor's **virtual origin for locally bundled files**, not
a remote `server.url` and not a website to deploy. Reserve that subdomain; do not host
untrusted content there. It shares a site with the API, so the existing SameSite=Lax
session cookies work without weakening them or enabling a broad native HTTP bypass.
The production API origin and callback are public constants in `shared/nativeApp.ts`.

## Google and Discord sign-in

Only the official App and Browser plugins are installed. Browser opens Android Custom
Tabs: Google/Discord authentication never runs inside the game WebView.

The provider redirect registrations remain:

```text
https://resurviv.biz/api/auth/google/callback
https://resurviv.biz/api/auth/discord/callback
```

Do **not** register the app scheme as a Google web-client callback or embed client
secrets in Android. Existing server OAuth clients still verify the provider state,
code verifier and verified-email status and create/link the existing Resurviv accounts.

The app first saves a random verifier and sends only its SHA-256 challenge to the API.
The server records an expiring request in PostgreSQL, so callbacks and exchanges work
across API instances. Account-link requests also require the app's existing session.
The system browser's separate login session is ignored for native requests.

After the normal HTTPS OAuth callback, the server redirects to:

```text
biz.resurviv.app://oauth/callback?request=<opaque-request-id>&code=<one-time-code>
```

The manifest handles this exact scheme/host/path. A matching pending request is
required, including after a cold start. The return code is generated only after provider
authentication and stored as a hash. The app POSTs that code and the verifier to the HTTPS exchange
endpoint, which atomically consumes the completed request and sets the normal session
cookie. No session token or provider access token travels in a deep link. Requests expire
after 10 minutes; completed returns expire after at most 2 minutes; daily cleanup removes
expired records. A stolen custom-scheme link is insufficient without the saved verifier.
Cancellation/failure creates no app session.

Verified HTTPS App Links and `assetlinks.json` are not necessary for this return flow.
No signing-certificate fingerprint is invented. If general game-invite App Links are
added later, their domain association must use the real Play signing certificate.

## Native behavior

- The existing Android user-agent detection, touch controls, viewport and resizing remain.
- MainActivity hides system bars, allows transient bars by swipe and keeps the display on.
- Back during a game toggles its existing menu; connecting games consume Back. In the lobby,
  an explicit confirmation is required before exiting.
- Links and `window.open` use the system browser. Relative public links resolve against
  `https://resurviv.biz`; the game WebView stays on its bundled content. Downloads keep
  their existing browser behavior and should be checked on a device.
- A connection failure at startup shows a retry screen. Gameplay requires network access.
- Android backup is disabled, and release WebView debugging and cleartext traffic are disabled.

## Google Play release

The generated project targets SDK 36, supports API 24+, uses the root package version as
`versionName`, and accepts `-PresurvivVersionCode=N` when running Gradle. Increment the
version code for each Play upload. For example, after `pnpm android:sync`:

```sh
cd mobile/android
./gradlew bundleRelease -PresurvivVersionCode=2
```

On Windows use `gradlew.bat`. The release bundle is intentionally unsigned. Use Android
Studio's **Generate Signed Bundle / APK** with your own upload key, or a private CI signing
setup, then use Play App Signing. Keystores, credentials, local SDK paths and generated
outputs are ignored. There are no release signing credentials in this project.
See [Capacitor's Play deployment guide](https://capacitorjs.com/docs/android/deploying-to-google-play).

Before release, test on an Android device with the deployed API: Google and Discord login,
new/existing accounts, linking/unlinking (including a different browser account), cancelled
and expired login, cold-start return, logout, deletion, friends/SSE, lobby and match WSS,
touch controls, rotation, keyboard, fullscreen, Back during play, external links, downloads,
and reconnect. Provider consent and session-cookie behavior require real device testing;
unit tests and an AAB build do not prove them. Review existing ads, purchases and Play
declarations separately; wrapping the client does not establish store-policy approval.
