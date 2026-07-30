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

- **Sync nearby** connects two open browsers directly on the same Wi-Fi. Scan the offer QR on the receiving device, then scan or paste its answer code on the sender. It works without internet or an account.
- **Encrypted cloud transfer** is an optional fallback for a deployed Cloudflare relay. It is manual, temporary, and end-to-end encrypted; Cloudflare receives encrypted frames only.
- **Encrypted file backup** creates a password-protected `.going-dutch-sync` file for recovery or manual transfer via AirDrop, Nearby Share, Bluetooth, USB, or removable storage.

Matching group histories merge rather than overwrite. None of these modes provides automatic background synchronization.

### Enable Cloudflare fallback

The primary nearby mode needs no deployment beyond the static app. To enable the optional Cloudflare fallback, deploy the separate Worker in `packages/cloud-sync` and configure two values before release:

1. Set `ALLOWED_ORIGINS` in `packages/cloud-sync/wrangler.jsonc` to the exact Cloudflare Pages origin (and any production custom domain).
2. Set `VITE_CLOUD_SYNC_URL` in the Pages build environment to the deployed Worker origin, such as `https://going-dutch-sync.example.workers.dev`.

Then deploy from the project root with `npx wrangler deploy --config packages/cloud-sync/wrangler.jsonc`. The fallback button remains hidden until the Pages build receives `VITE_CLOUD_SYNC_URL`.

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
