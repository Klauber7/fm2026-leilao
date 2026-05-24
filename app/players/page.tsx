import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default async function PlayersPage() {
  const { data: players } = await supabase
    .from("players")
    .select("*");

  return (
    <main className="min-h-screen bg-zinc-900 text-white p-10">
      <h1 className="text-4xl font-bold mb-8">
        Jogadores no Leilão
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {players?.map((player) => (
          <Link
            href={`/players/${player.id}`}
            key={player.id}
            className="bg-zinc-800 rounded-2xl p-4 block cursor-pointer hover:bg-zinc-700"
          >
            <h2 className="text-2xl font-bold">
              {player.name}
            </h2>

            <p>{player.position}</p>
            <p>{player.age} anos</p>

            <p className="mt-2 text-green-400">
              Valor inicial: ${player.starting_price}
            </p>

            <p className="mt-4 text-blue-400">
              Abrir leilão →
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}