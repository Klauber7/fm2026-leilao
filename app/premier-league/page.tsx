import Standings2026 from "./Standings2026";

export default function PremierLeaguePage() {
  return (
    <main className="min-h-screen bg-[#08090b] px-4 py-8 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-green-400">FriendZone League FM</p>
          <h1 className="mt-2 text-4xl font-black md:text-6xl">🏆 FriendZone Premier League</h1>
        </header>
        <Standings2026 />
      </div>
    </main>
  );
}
