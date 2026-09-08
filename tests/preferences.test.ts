import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PREFERENCES,
  getDeviceLanguage,
  normalisePreferences,
  resolveTheme,
} from "../src/lib/preferences.js";

test("preference normalization keeps valid selections and rejects invalid values", () => {
  assert.deepEqual(
    normalisePreferences({ theme: "light", language: "vi", balanceCardDensity: "compact" }, "en-US"),
    { theme: "light", language: "vi", balanceCardDensity: "compact" },
  );
  assert.deepEqual(
    normalisePreferences({ theme: "night", language: "fr", balanceCardDensity: "dense" }, "vi-VN"),
    { ...DEFAULT_PREFERENCES, language: "vi" },
  );
});

test("device language chooses Vietnamese only for Vietnamese device locales", () => {
  assert.equal(getDeviceLanguage("vi-VN"), "vi");
  assert.equal(getDeviceLanguage("en-US"), "en");
  assert.equal(getDeviceLanguage("fr-FR"), "en");
});

test("device theme resolves from current color-scheme preference", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("device", true), "dark");
  assert.equal(resolveTheme("device", false), "light");
});
