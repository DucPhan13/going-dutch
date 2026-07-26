# Going Dutch

Split the tab for a night out, a trip, or the group house. Your data stays in your browser.

[Try the live app](https://going-dutch.ducpm1.io.vn/)

## It starts when the bill arrives

Every table has the Tiger drinker, the person with “non-alcoholic rice wine” who actually ordered water, and someone loyal to “sweet dark beer,” also known as Coca-Cola. When the bill arrives, everyone remembers exactly how little they had.

Going Dutch handles that last part. Create a group, add expenses, choose who paid, and include the people sharing each item. The app works out who needs to pay whom.

## Where does the data go?

Into your browser's `localStorage`.

- No account required.
- No backend storing your expense history.
- No collection of group, member, or expense data.

That also means clearing your browser data clears the app's data. The app only knows what your browser keeps.

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
