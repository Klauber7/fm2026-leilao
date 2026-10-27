import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const ts = require("typescript");
// Compile the pure TypeScript helpers in memory; no extra runner dependency.
const cache = new Map();
function load(file) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute);
  const js = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const localRequire = (name) => name.startsWith(".") ? load(path.resolve(path.dirname(absolute), `${name}.ts`)) : require(name);
  new Function("require", "module", "exports", js)(localRequire, module, module.exports);
  cache.set(absolute, module.exports);
  return module.exports;
}
const { FORMATIONS, addPlayerToPlan, assignStarter, changeFormation, cleanPlan, emptyPlan, suggestStarters, planTotals } = load("lib/team-planning.ts");
const player = (id, position, team_id = 1, value = 10, ca = 100) => ({ id, name: `Player ${id}`, position, natural_position: position, category: [], team_id, value, ca, cp: null, age: 25, image_url: null });

test("every formation has eleven slots and one goalkeeper", () => {
  for (const rows of Object.values(FORMATIONS)) {
    assert.equal(rows.flat().length, 11);
    assert.equal(rows.flat().filter((s) => s.group === "goalkeepers").length, 1);
  }
});
test("selection swaps starters, moves reserves in and clears to the bench without duplicates", () => {
  const original = [1, 2, 3, ...Array(8).fill(null)];
  assert.deepEqual(assignStarter(original, 0, 2).slice(0, 3), [2, 1, 3]);
  assert.deepEqual(assignStarter(original, 0, 4).slice(0, 3), [4, 2, 3]);
  assert.equal(assignStarter(original, 0, null)[0], null);
  assert.deepEqual(original.slice(0, 3), [1, 2, 3]);
});
test("formation changes keep every starter exactly once and preserve the goalkeeper", () => {
  const plan = { ...emptyPlan(1, "lineup"), starters: Array.from({ length: 11 }, (_, i) => i + 1) };
  for (const formation of Object.keys(FORMATIONS)) {
    const next = changeFormation(plan, formation);
    assert.deepEqual([...next.starters].sort((a, b) => a - b), plan.starters);
    assert.equal(next.starters[10], 11);
  }
});
test("lineups prune transferred or removed players; planning treats a transferred starter as a target", () => {
  const plan = { ...emptyPlan(1, "lineup"), starters: [1, 2, 3, ...Array(8).fill(null)] };
  const players = [player(1, "ST"), player(2, "ST", 2)];
  assert.deepEqual(cleanPlan(plan, players, 1).starters.slice(0, 3), [1, null, null]);
  const simulated = cleanPlan({ ...plan, kind: "planning" }, players, 1);
  assert.deepEqual(simulated.starters.slice(0, 3), [1, 2, null]);
  assert.deepEqual(simulated.targets, [2]);
});
test("targets acquired by the club are no longer charged; projections deduplicate and include bench targets", () => {
  const rows = [player(1, "GK"), player(2, "ST", 2, 70), player(3, "CB", null, 40)];
  const plan = { ...emptyPlan(1, "planning"), targets: [1, 2, 3] };
  assert.deepEqual(cleanPlan(plan, rows, 1).targets, [2, 3]);
  const result = planTotals([...rows, rows[1]], 1, 100, 5);
  assert.equal(result.cost, 110);
  assert.equal(result.balance, -15);
  assert.equal(result.count, 3);
  assert.equal(result.goalkeepers, 1);
});
test("suggestions choose by position and CA and leave unavailable positions empty", () => {
  const starters = suggestStarters([player(1, "GK", 1, 10, 120), player(2, "GK", 1, 10, 110), player(3, "ST")], "4-3-3");
  assert.equal(starters[10], 1);
  assert.equal(starters[1], 3);
  assert.equal(starters.filter(Boolean).length, 2);
});

test("any shortlist player, including one owned by another club, can be planned without changing ownership", () => {
  const candidate = player(7, "ST", 2, 70);
  const original = emptyPlan(1, "planning");
  const reserve = addPlayerToPlan(original, candidate);
  assert.deepEqual(reserve.targets, [7]);
  assert.equal(reserve.starters.filter(Boolean).length, 0);
  const starter = addPlayerToPlan(reserve, candidate, 1);
  assert.deepEqual(starter.targets, [7]);
  assert.equal(starter.starters[1], 7);
  assert.equal(planTotals([candidate], 1, 100, 0).balance, 30);
  assert.equal(candidate.team_id, 2);
  assert.deepEqual(original.targets, []);
  assert.deepEqual(addPlayerToPlan(emptyPlan(1, "lineup"), candidate).targets, []);
});
