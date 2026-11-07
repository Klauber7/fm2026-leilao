const positions = [
  { label: "Goleiro", x: 15, y: 60 },
  { label: "Líbero", x: 31, y: 60 },
  { label: "Lateral esquerdo", x: 48, y: 20 },
  { label: "Zagueiro", x: 48, y: 60 },
  { label: "Lateral direito", x: 48, y: 100 },
  { label: "Volante", x: 76, y: 60 },
  { label: "Meia esquerdo", x: 104, y: 20 },
  { label: "Meia central", x: 104, y: 60 },
  { label: "Meia direito", x: 104, y: 100 },
  { label: "Meia ofensivo esquerdo", x: 135, y: 20 },
  { label: "Meia ofensivo central", x: 135, y: 60 },
  { label: "Meia ofensivo direito", x: 135, y: 100 },
  { label: "Centroavante", x: 164, y: 60 },
  { label: "Ala esquerdo", x: 76, y: 20 },
  { label: "Ala direito", x: 76, y: 100 },
] as const;

function ratingColor(rating: number) {
  if (rating >= 18) return "#4ade50";
  if (rating >= 15) return "#c7e237";
  if (rating >= 12) return "#facc15";
  if (rating >= 8) return "#fb923c";
  return "#27272a";
}

export default function PositionMap({
  ratings,
  compact = false,
}: {
  ratings: number[] | null | undefined;
  compact?: boolean;
}) {
  if (
    !Array.isArray(ratings) ||
    ratings.length !== positions.length ||
    !ratings.every((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 20)
  ) {
    return null;
  }

  const bestRating = Math.max(...ratings);
  const best = positions[ratings.indexOf(bestRating)];

  return (
    <figure className={compact ? "w-[42%] min-w-20 max-w-32 shrink-0" : "w-full max-w-56"}>
      <svg
        viewBox="0 0 180 120"
        role="img"
        aria-label={`Mapa de posições. ${positions
          .map(({ label }, index) => `${label}: ${ratings[index]} de 20`)
          .join("; ")}`}
        className="block w-full rounded border border-emerald-100/60"
      >
        <rect width="180" height="120" fill="#10483d" />
        <g fill="none" stroke="#a7d5c4" strokeOpacity=".45">
          <path d="M90 0v120 M0 30h25v60H0 M180 30h-25v60h25 M0 46h8v28H0 M180 46h-8v28h8" />
          <circle cx="90" cy="60" r="13" />
        </g>
        {positions.map(({ label, x, y }, index) => (
          <g key={label}>
            <title>{label}: {ratings[index]}/20</title>
            {ratings[index] === bestRating && (
              <circle cx={x} cy={y} r="8" fill="none" stroke="#ecfdf5" strokeWidth="1.5" />
            )}
            <circle cx={x} cy={y} r="5.2" fill={ratingColor(ratings[index])} stroke="#092d27" />
          </g>
        ))}
      </svg>
      <figcaption className={`mt-1 text-center text-zinc-300 ${compact ? "text-[10px] leading-tight" : "text-xs"}`}>
        {best.label}{!compact && ` · ${bestRating}/20`}
      </figcaption>
    </figure>
  );
}
