import assert from "node:assert/strict";
import test from "node:test";

import {
  displayNameFromLeaguepediaPage,
  normalizeLeaguepediaKey,
  resolveLeaguepediaIdentity,
} from "./leaguepedia-identity.ts";

const lyon = {
  id: "lyon-id",
  slug: "lyon",
  name: "LYON",
  short_name: "LYON",
  leaguepedia_page: "LYON",
  source_id: "lp:LYON",
};

test("keeps the raw page key while deriving a clean display name", () => {
  assert.equal(displayNameFromLeaguepediaPage("Saint (Kang Sung-in)"), "Saint");
  assert.equal(normalizeLeaguepediaKey("lp:LYON_(2024 American Team)"), "lyon (2024 american team)");
});

test("resolves a parenthetical team name through a unique display fallback", () => {
  assert.equal(resolveLeaguepediaIdentity("LYON (2024 American Team)", [lyon])?.id, lyon.id);
});

test("prefers an exact alias over display fallback", () => {
  const other = { ...lyon, id: "other-id", slug: "other", leaguepedia_page: "Other" };
  const result = resolveLeaguepediaIdentity(
    "LYON (2024 American Team)",
    [lyon, other],
    [{ entity_id: other.id, page_name: "LYON (2024 American Team)" }],
  );
  assert.equal(result?.id, other.id);
});

test("does not collapse ambiguous cleaned names", () => {
  const first = { id: "1", name: "JoJo", leaguepedia_page: "JoJo (One)" };
  const second = { id: "2", name: "JoJo", leaguepedia_page: "JoJo (Two)" };
  assert.equal(resolveLeaguepediaIdentity("JoJo", [first, second]), null);
});
