# Preferences: theme, language, and balance-card density

## Problem Statement

Going Dutch has a light/dark toggle only. It cannot follow device theme, switch English and Vietnamese, or adjust balance-card density.

## Solution

Add one browser-local preferences store. It controls theme, language, and balance-card density without changing group, expense, balance, transaction, or sync data.

## User Stories

1. As a user, I can choose light, dark, or device theme.
2. As a user, device theme follows operating-system changes while selected.
3. As a user, I can switch English and Vietnamese.
4. As a user, app text updates without losing current page or group data.
5. As a Vietnamese user, I see Vietnamese interface labels.
6. As an English user, I see English interface labels.
7. As a user, I can choose expanded or compact balance cards.
8. As a user, expanded balance cards show payer and recipient avatars, names, debt direction, amount, and payment action.
9. As a user, compact balance cards hide avatars but retain names, debt direction, amount, and payment action.
10. As a user, choices persist after reload.
11. As a user, preferences stay local to this browser and do not alter shared group data.
12. As a keyboard user, I can operate every setting and see its selected state.
13. As a screen-reader user, I receive clear labels for theme, language, density, and balance actions.
14. As a mobile user, settings and compact cards fit without horizontal scrolling.
15. As a user with reduced motion enabled, switching preferences does not introduce disruptive animation.

## Implementation Decisions

- Add one app-wide preferences provider with browser-local persistence.
- Theme values: `light`, `dark`, `device`.
- Existing saved light/dark choices remain valid. No saved choice defaults to device theme.
- Device theme resolves from `prefers-color-scheme` and reacts to OS changes.
- Language values: `en`, `vi`. Default from device language, falling back to English.
- Translate app-owned UI text only. Group names, member names, expense descriptions, notes, and receipts remain unchanged.
- Keep VND as currency in both languages. Formatting follows active locale.
- Add a settings control in shared navigation for theme, language, and balance-card density.
- Density values: `expanded`, `compact`.
- Apply density only to balance cards in group-detail Balance tab.
- Expanded cards show both members' avatars and names, debt direction, amount, and action.
- Compact cards omit avatars while preserving names, debt direction, amount, and action.
- Preferences do not enter Automerge documents, encrypted archives, nearby sync, or cloud transfer.
- Preserve current balance calculation and payment behavior.

## Testing Decisions

- Test preference resolution as external behavior: defaults, saved settings, device-theme resolution, and device-theme changes.
- Test persistence round trips for all three settings.
- Test translated UI labels through rendered behavior.
- Test expanded and compact balance-card output with the same balance input.
- Test payment action behavior remains identical in both layouts.
- Test keyboard access, selected-state semantics, focus visibility, and mobile overflow.
- Keep existing pure Node test seam for amount and settlement behavior. Add UI coverage at the preferences and balance-card boundary.

## Out of Scope

- Profile-photo uploads.
- Per-group or synced preferences.
- Currency selection or exchange conversion.
- Translation of user-entered content.
- Changes to settlement math, expenses, transactions, archive format, or sync protocol.

## Further Notes

- Existing theme behavior defaults to dark. New default becomes device theme only when no saved preference exists.
- The required tracker label `ready-for-agent` must be created before publishing.
