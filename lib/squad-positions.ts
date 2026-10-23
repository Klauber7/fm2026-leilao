export const POSITION_SECTIONS = [
  { key: "goalkeepers", title: "Goleiros", abbreviation: "GK" },
  { key: "centrebacks", title: "Zagueiros", abbreviation: "ZAG" },
  { key: "fullbacks", title: "Laterais", abbreviation: "LAT" },
  { key: "defensiveMidfielders", title: "Volantes", abbreviation: "VOL" },
  { key: "midfielders", title: "Meias", abbreviation: "MEI" },
  { key: "wingers", title: "Pontas", abbreviation: "PON" },
  { key: "attackers", title: "Atacantes", abbreviation: "ATA" },
  { key: "others", title: "Sem posição definida", abbreviation: "—" },
] as const;

export type PositionGroup = (typeof POSITION_SECTIONS)[number]["key"];

type PositionedPlayer = {
  position: string | null;
  natural_position?: string | null;
  category?: string[] | null;
};

function normalize(value: string | null | undefined) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toUpperCase().replace(/\s+/g, " ");
}

function classify(value: string | null | undefined): PositionGroup | null {
  const p = normalize(value);
  if (!p) return null;
  if (/^(GR|GK|GOL)\b|GOLEIRO|GOALKEEPER|GUARDA[- ]?REDES/.test(p)) return "goalkeepers";
  if (/VOLANTE|DEFENSIVE MIDFIELDER|^(MD|DM|DMC|VOL)\b/.test(p)) return "defensiveMidfielders";
  if (/ZAGUEIRO|CENT(RE|ER) BACK|CENTRAL DEFENDER|^(DC|CB|ZAG)\b/.test(p)) return "centrebacks";
  if (/LATERAL|WING.?BACK|FULL.?BACK|RIGHT BACK|LEFT BACK|^(DL|DR|DD|DE|LD|LE|LB|RB|WB|WBL|WBR|ALA)\b/.test(p)) return "fullbacks";
  if (/PONTA|EXTREMO|WINGER|^(LW|RW|AML|AMR|ML|MR|PD|PE)\b/.test(p)) return "wingers";
  if (/MEIA|MEIO|MIDFIELDER|^(MC|CM|AMC|AM)\b/.test(p)) return "midfielders";
  if (/ATACANTE|AVANCADO|STRIKER|FORWARD|CENTROAVANTE|^(PL|ST|CF|FW)\b/.test(p)) return "attackers";

  // FM combines roles with slashes (D/DA/M) and sides inside parentheses.
  // Use the first listed role and side when several positions are equally natural.
  const fm = p.match(/^(D|DA|M|MO)(?:\/(?:D|DA|M|MO))*\s*\(([DEC]+|[RLC]+)\)/);
  if (!fm) return null;
  const role = fm[1];
  const side = fm[2][0];
  if (role === "D") return side === "C" ? "centrebacks" : "fullbacks";
  if (role === "DA") return "fullbacks";
  return side === "C" ? "midfielders" : "wingers";
}

export function getPositionGroup(player: PositionedPlayer): PositionGroup {
  // The primary position takes precedence over the imported list category.
  const natural = classify(player.natural_position);
  if (natural) return natural;
  for (const category of player.category || []) {
    const group = classify(category);
    if (group) return group;
  }
  return classify(player.position) || "others";
}

export function getPositionBadge(player: PositionedPlayer) {
  return POSITION_SECTIONS.find((section) => section.key === getPositionGroup(player))!.abbreviation;
}

export function groupSquadPlayers<T extends PositionedPlayer & { name: string; ca: number | null }>(players: T[]) {
  return POSITION_SECTIONS.map((section) => ({
    ...section,
    players: players.filter((player) => getPositionGroup(player) === section.key)
      .sort((a, b) => (b.ca ?? -1) - (a.ca ?? -1) || a.name.localeCompare(b.name, "pt-BR")),
  })).filter((section) => section.players.length > 0);
}
