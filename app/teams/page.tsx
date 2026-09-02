import { supabase } from "@/lib/supabase";

export default async function TeamsPage() {
  const { data: teams, error } = await supabase
    .from("teams")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-10">
        <h1 className="text-3xl font-bold text-red-400">
          Erro ao carregar times
        </h1>
        <p>{error.message}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-4xl font-bold mb-8">Times FM2026</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {teams?.map((team) => (
          <div
            key={team.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg"
          >
            <h2 className="text-2xl font-bold">{team.name}</h2>

            <p className="mt-4 text-green-400 font-semibold">
              Saldo: R${" "}
              {Number(team.budget).toLocaleString("pt-BR")}
            </p>

            <p className="text-slate-400 mt-2">
              País: {team.country || "Brasil"}
            </p>

            <a
              href={`/teams/${team.id}`}
              className="inline-block mt-5 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold"
            >
              Ver elenco
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}