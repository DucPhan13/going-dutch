# Design — Going Dutch

## Genre
Modern-minimal. Calm financial clarity over dashboard decoration.

## Macrostructure family
- App pages: Workbench — a focused page heading, one balance-led primary surface, and low-density supporting rows.
- Content pages: chronological ledger with compact filters.

## Theme
Dark-first, green-anchored surfaces. Source palette is expressed in OKLCH tokens in `tokens.css`; light mode uses the same roles with an airy paper surface.

## Typography
- Display: Space Grotesk, 600, roman
- Body: IBM Plex Sans, 400–600
- Mono: IBM Plex Mono, 500

## Spacing and motion
Four-point token scale. Short transform/opacity transitions only; reduced motion is opacity-only.

## Product rules
- Green expresses an amount receivable, never decoration.
- Red expresses an amount owed, never a destructive action by itself.
- One primary action per view. Settlement is an explicit, reviewable action.
- App screens use surfaces and dividers, not glass effects or nested bento tiles.

## Exports
The canonical portable tokens are in `tokens.css`.
