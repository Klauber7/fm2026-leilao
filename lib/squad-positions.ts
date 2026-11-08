export const POSITION_SECTIONS = [
  { key: "goalkeepers", title: "Goleiros", abbreviation: "GK", category: "Goleiro", ratings: [0] },
  { key: "centrebacks", title: "Zagueiros", abbreviation: "ZAG", category: "Zagueiro", ratings: [3] },
  { key: "rightBacks", title: "Lateral direito", abbreviation: "LD", category: "Lateral direito", ratings: [4, 14] },
  { key: "leftBacks", title: "Lateral esquerdo", abbreviation: "LE", category: "Lateral esquerdo", ratings: [2, 13] },
  { key: "defensiveMidfielders", title: "Volantes", abbreviation: "VOL", category: "Volante", ratings: [5, 7] },
  { key: "centralAttackingMidfielders", title: "Meia ofensivo central", abbreviation: "MOC", category: "Meia ofensivo central", ratings: [10] },
  { key: "leftAttackingMidfielders", title: "Meia ofensivo esquerdo", abbreviation: "MOE", category: "Meia ofensivo esquerdo", ratings: [6, 9] },
  { key: "rightAttackingMidfielders", title: "Meia ofensivo direito", abbreviation: "MOD", category: "Meia ofensivo direito", ratings: [8, 11] },
  { key: "attackers", title: "Centroavante", abbreviation: "CA", category: "Centroavante", ratings: [12] },
] as const;

const others = { key: "others", title: "Sem posição definida", abbreviation: "—" } as const;
const sections = [...POSITION_SECTIONS, others];
export type PositionGroup = (typeof sections)[number]["key"];

type PositionedPlayer = {
  position: string | null;
  natural_position?: string | null;
  category?: string[] | null;
  position_ratings?: number[] | null;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

const legacyPositions = {
  goalkeepers: /\b(GK|GR|GOL|GOLEIRO|GOALKEEPER)\b/,
  centrebacks: /\b(DC|CB|ZAG|ZAGUEIRO|SW|LIBERO)\b|D\s*\([DELRC]*C/,
  rightBacks: /\b(DR|DD|LD|RB|WBR)\b|(?:LATERAL|ALA) DIREITO|D(?:\/DA)?\s*\([DELRC]*[DR]/,
  leftBacks: /\b(DL|DE|LE|LB|WBL)\b|(?:LATERAL|ALA) ESQUERDO|D(?:\/DA)?\s*\([DELRC]*[EL]/,
  defensiveMidfielders: /\b(DM|DMC|MD|MC|CM|VOL|VOLANTE)\b|MEIA CENTRAL|\bM\s*\([DELRC]*C/,
  centralAttackingMidfielders: /\b(AMC|MOC)\b|MEIA (?:ATACANTE|OFENSIVO CENTRAL)|MO\s*\([DELRC]*C/,
  leftAttackingMidfielders: /\b(AML|ML|LW|PE|MOE)\b|(?:PONTA|MEIA(?: OFENSIVO)?) ESQUERD[OA]|\bM(?:O)?\s*\([DELRC]*[EL]/,
  rightAttackingMidfielders: /\b(AMR|MR|RW|PD|MOD)\b|(?:PONTA|MEIA(?: OFENSIVO)?) DIREIT[OA]|\bM(?:O)?\s*\([DELRC]*[DR]/,
  attackers: /\b(ST|STC|CF|PL|ATA|ATACANTE|CENTROAVANTE|STRIKER|AVANCADO)\b/,
};

function positionScore(ratings: number[], section: (typeof POSITION_SECTIONS)[number]) {
  return Math.max(...section.ratings.map((index) => ratings[index]));
}

export function getPositionGroups(player: PositionedPlayer): PositionGroup[] {
  const ratings = player.position_ratings;
  if (ratings?.length === 15) {
    const groups = POSITION_SECTIONS.filter((section) => positionScore(ratings, section) >= 18);
    if (groups.length) return groups.map((section) => section.key);
    if (ratings[1] >= 18) return ["centrebacks"];
  }

  const labels = [player.natural_position, player.position, ...(player.category ?? [])]
    .filter((label): label is string => Boolean(label)).map(normalize);
  const groups = POSITION_SECTIONS.filter(({ key, category }) =>
    labels.some((label) => label === normalize(category) || legacyPositions[key].test(label)));
  return groups.length ? groups.map((section) => section.key) : ["others"];
}

export function getPositionGroup(player: PositionedPlayer): PositionGroup {
  const groups = getPositionGroups(player);
  const ratings = player.position_ratings;
  if (ratings?.length !== 15) return groups[0];
  const ranked = POSITION_SECTIONS.filter(({ key }) => groups.includes(key))
    .sort((a, b) => positionScore(ratings, b) - positionScore(ratings, a));
  return ranked[0]?.key ?? groups[0];
}

export function getPositionBadge(player: PositionedPlayer) {
  return sections.find((section) => section.key === getPositionGroup(player))!.abbreviation;
}

export function groupSquadPlayers<T extends PositionedPlayer & { name: string; ca: number | null }>(players: T[]) {
  const classified = players.map((player) => ({ player, groups: getPositionGroups(player) }));
  return sections.map((section) => ({
    ...section,
    players: classified.filter(({ groups }) => groups.includes(section.key)).map(({ player }) => player)
      .sort((a, b) => (b.ca ?? -1) - (a.ca ?? -1) || a.name.localeCompare(b.name, "pt-BR")),
  })).filter((section) => section.players.length > 0);
}
