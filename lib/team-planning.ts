import { getPositionGroup, type PositionGroup } from "./squad-positions";

export type PlanningPlayer = {
  id: number;
  name: string;
  position: string | null;
  natural_position: string | null;
  category: string[] | null;
  age: number | null;
  ca: number | null;
  cp: number | null;
  value: number | null;
  image_url: string | null;
  team_id: number | null;
};

export const PLANNING_PLAYER_COLUMNS = "id,name,position,natural_position,category,age,ca,cp,value,image_url,team_id";
export type PlanningTeam = { id: number; name: string; budget: number | null };
export type PlanKind = "lineup" | "planning";
export type TeamPlan = {
  id: string;
  team_id: number;
  kind: PlanKind;
  name: string;
  formation: Formation;
  starters: (number | null)[];
  targets: number[];
  staff_budget: number;
  updated_at?: string;
};

type Slot = { label: string; group: PositionGroup };
const slot = (label: string, group: PositionGroup): Slot => ({ label, group });
const backFour = [slot("LE", "fullbacks"), slot("ZAG", "centrebacks"), slot("ZAG", "centrebacks"), slot("LD", "fullbacks")];
const wings = [slot("PE", "wingers"), slot("ATA", "attackers"), slot("PD", "wingers")];

// Rows run from the attacking goal to the goalkeeper. Indices stay stable in storage.
export const FORMATIONS = {
  "4-3-3": [wings, [slot("MC", "midfielders"), slot("VOL", "defensiveMidfielders"), slot("MC", "midfielders")], backFour, [slot("GOL", "goalkeepers")]],
  "4-2-3-1": [[slot("ATA", "attackers")], [slot("PE", "wingers"), slot("MEI", "midfielders"), slot("PD", "wingers")], [slot("VOL", "defensiveMidfielders"), slot("VOL", "defensiveMidfielders")], backFour, [slot("GOL", "goalkeepers")]],
  "4-4-2": [[slot("ATA", "attackers"), slot("ATA", "attackers")], [slot("PE", "wingers"), slot("MC", "midfielders"), slot("MC", "midfielders"), slot("PD", "wingers")], backFour, [slot("GOL", "goalkeepers")]],
  "3-5-2": [[slot("ATA", "attackers"), slot("ATA", "attackers")], [slot("LE", "fullbacks"), slot("MC", "midfielders"), slot("VOL", "defensiveMidfielders"), slot("MC", "midfielders"), slot("LD", "fullbacks")], [slot("ZAG", "centrebacks"), slot("ZAG", "centrebacks"), slot("ZAG", "centrebacks")], [slot("GOL", "goalkeepers")]],
  "4-1-4-1": [[slot("ATA", "attackers")], [slot("PE", "wingers"), slot("MC", "midfielders"), slot("MC", "midfielders"), slot("PD", "wingers")], [slot("VOL", "defensiveMidfielders")], backFour, [slot("GOL", "goalkeepers")]],
} as const;
export type Formation = keyof typeof FORMATIONS;

export function isFormation(value: string): value is Formation {
  return Object.hasOwn(FORMATIONS, value);
}

export function emptyPlan(teamId: number, kind: PlanKind): TeamPlan {
  return { id: crypto.randomUUID(), team_id: teamId, kind, name: kind === "lineup" ? "Minha escalação" : "Meu planejamento", formation: "4-3-3", starters: Array(11).fill(null), targets: [], staff_budget: 0 };
}

/** A player can occupy just one slot. Selecting another starter swaps the two. */
export function assignStarter(starters: (number | null)[], index: number, playerId: number | null) {
  if (index < 0 || index > 10) return starters;
  const next = [...starters];
  const previous = playerId === null ? -1 : next.indexOf(playerId);
  if (previous !== -1 && previous !== index) next[previous] = next[index];
  next[index] = playerId;
  return next;
}

/** Selecting a shortlist candidate adds it to this plan only, never to the club. */
export function addPlayerToPlan(plan: TeamPlan, player: PlanningPlayer, index: number | null = null): TeamPlan {
  if (plan.kind === "lineup" && player.team_id !== plan.team_id) return plan;
  return {
    ...plan,
    targets: plan.kind === "planning" && player.team_id !== plan.team_id
      ? [...new Set([...plan.targets, player.id])] : plan.targets,
    starters: index === null ? plan.starters : assignStarter(plan.starters, index, player.id),
  };
}

/** Preserve players in comparable roles when changing shape, then fill remaining slots. */
export function changeFormation(plan: TeamPlan, formation: Formation): TeamPlan {
  const oldSlots = FORMATIONS[plan.formation].flat();
  const available = plan.starters.flatMap((id, index) => id === null ? [] : [{ id, group: oldSlots[index].group }]);
  const starters = FORMATIONS[formation].flat().map((target) => {
    const index = available.findIndex((entry) => entry.group === target.group);
    return index < 0 ? null : available.splice(index, 1)[0].id;
  });
  for (let i = 0; i < starters.length && available.length; i++) {
    if (starters[i] === null) starters[i] = available.shift()!.id;
  }
  return { ...plan, formation, starters };
}

export function suggestStarters(players: PlanningPlayer[], formation: Formation) {
  const available = [...players].sort((a, b) => (b.ca ?? -1) - (a.ca ?? -1));
  return FORMATIONS[formation].flat().map((target) => {
    const index = available.findIndex((player) => getPositionGroup(player) === target.group);
    return index === -1 ? null : available.splice(index, 1)[0].id;
  });
}

export function cleanPlan(plan: TeamPlan, players: PlanningPlayer[], teamId: number): TeamPlan {
  const eligible = new Set(players.filter((p) => plan.kind === "planning" || p.team_id === teamId).map((p) => p.id));
  const seen = new Set<number>();
  const starters = Array.from({ length: 11 }, (_, index) => {
    const id = plan.starters[index];
    if (!id || !eligible.has(id) || seen.has(id)) return null;
    seen.add(id);
    return id;
  });
  const targets = plan.kind === "planning" ? [...new Set([...plan.targets, ...starters.filter((id): id is number => id !== null)])].filter((id) => eligible.has(id) && players.find((p) => p.id === id)?.team_id !== teamId) : [];
  return { ...plan, starters, targets, formation: isFormation(plan.formation) ? plan.formation : "4-3-3" };
}

export function planTotals(players: PlanningPlayer[], teamId: number, budget: number | null, staffBudget: number) {
  const distinct = [...new Map(players.map((p) => [p.id, p])).values()];
  const targets = distinct.filter((p) => p.team_id !== teamId);
  const cost = targets.reduce((sum, p) => sum + Number(p.value || 0), 0);
  const ca = distinct.filter((p) => p.ca !== null);
  const ages = distinct.filter((p) => p.age !== null);
  return {
    cost,
    balance: Number(budget || 0) - cost - staffBudget,
    count: distinct.length,
    goalkeepers: distinct.filter((p) => getPositionGroup(p) === "goalkeepers").length,
    averageCa: ca.length ? Math.round(ca.reduce((sum, p) => sum + p.ca!, 0) / ca.length) : null,
    averageAge: ages.length ? (ages.reduce((sum, p) => sum + p.age!, 0) / ages.length).toFixed(1) : null,
    unpriced: targets.filter((p) => p.value === null || Number(p.value) <= 0).length,
  };
}

export function money(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
