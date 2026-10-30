import SuperCupFinal from "./SuperCupFinal";

export default function SuperCupPage() {
  return (
    <main className="min-h-screen bg-[#08090b] px-4 py-8 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-green-400">
          FriendZone League FM
        </p>

        <h1 className="mt-2 text-4xl font-black md:text-6xl">
          🥇 FriendZone Super Cup
        </h1>

        <p className="mt-4 text-zinc-400">
          Campeão da Premier League × campeão da FriendZone Cup.
        </p>
        <div className="mt-8"><SuperCupFinal /></div>
      </div>
    </main>
  );
}