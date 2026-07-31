# Going Dutch

Split the tab for a night out, a trip, or the group house. Your data stays in your browser.

[Try the live app](https://going-dutch.ducpm1.io.vn/)

## It starts when the bill arrives

Every table has the Tiger drinker, the person with “non-alcoholic rice wine” who actually ordered water, and someone loyal to “sweet dark beer,” also known as Coca-Cola. When the bill arrives, everyone remembers exactly how little they had.

Going Dutch handles that last part. Create a group, add expenses, choose who paid, and include the people sharing each item. The app works out who needs to pay whom.

## Where does the data go?

Into IndexedDB in your browser as one local-first document per group.

- No account required.
- No backend or relay storing your expense history.
- No collection of group, member, or expense data.

That also means clearing your browser data clears the app's data. The app only knows what your browser keeps.

## Device sync and backup

Open a group and choose **Sync** to transfer that group to another device.

- **Sync nearby** connects two open browsers directly on the same Wi-Fi. The sender shows a QR code and six-digit code that expires after 60 seconds. Cloudflare coordinates the WebRTC connection, while group data travels directly between the devices.
- **Encrypted cloud transfer** is an optional fallback for a deployed Cloudflare relay. It is manual, temporary, and end-to-end encrypted; Cloudflare receives encrypted frames only.
- **Encrypted file backup** creates a password-protected `.going-dutch-sync` file for recovery or manual transfer via AirDrop, Nearby Share, Bluetooth, USB, or removable storage.

Matching group histories merge rather than overwrite. None of these modes provides automatic background synchronization.

### Enable Cloudflare sync services

Nearby pairing and the optional encrypted cloud fallback use the separate Worker in `packages/cloud-sync`. Configure two values before release:

1. Set `ALLOWED_ORIGINS` in `packages/cloud-sync/wrangler.jsonc` to the exact Cloudflare Pages origin (and any production custom domain).
2. Set `VITE_CLOUD_SYNC_URL` in the Pages build environment to the deployed Worker origin, such as `https://going-dutch-sync.example.workers.dev`.

Then deploy from the project root with `npx wrangler deploy --config packages/cloud-sync/wrangler.jsonc`. Nearby code pairing is unavailable until the Pages build receives `VITE_CLOUD_SYNC_URL`, and the encrypted cloud fallback button remains hidden.

Going Dutch is installable as a PWA. Open it online once so the app shell is cached, then it can launch and operate in airplane mode.

## What it does

- Create groups and add members.
- Add expenses with dates, categories, notes, and receipt photos.
- Split equally, by shares, percentage, or exact amount.
- View activity, balances, and suggested payments.
- Record payments when the group settles up.

## Run locally

```sh
npm install
npm run dev      # http://localhost:8080
npm run build    # production build
npm run lint     # ESLint check
npm run preview  # preview the production build
```

## Tech

Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui, and Cloudflare Workers.

## Changelog

### 2026-07-31 — Nearby device sync

- Replaced manual WebRTC offer and answer exchange with a QR code and six-digit pairing room.
- Added a 60-second expiry for pairing codes and Cloudflare Durable Object signaling rooms.
- Kept group transfer peer-to-peer over WebRTC; the Worker exchanges connection signals only.
- Added clear waiting, connecting, transferring, merging, success, and failure states.
- Pairing dialogs now show completion briefly, then close automatically on both devices.
- Connection and configuration errors remain visible with retry or fallback actions.
