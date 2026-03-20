<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Tencent Map Security (Signature)

For Tencent JS API GL, this project supports `serviceHost` proxy mode so the browser does not expose your key.

Set environment variables in `.env.local`:

- `VITE_TENCENT_MAP_SERVICE_HOST=/_TMapService`
- `TENCENT_MAP_KEY=your_tencent_key`
- `TENCENT_MAP_SK=your_webservice_sk` (optional, used to add `sig` for `/ws` requests)

Notes:

- When `VITE_TENCENT_MAP_SERVICE_HOST` is set, frontend loads `gljs` without `key` in URL.
- Vite dev server proxies `/_TMapService/*` and injects key server-side.
- If `TENCENT_MAP_SK` is set, proxy auto-generates `sig` for WebService calls.
