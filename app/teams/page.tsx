import { supabase } from "@/lib/supabase";

export default async function TeamsPage() {
  const { data: teams, error } = await supabase
    .from("teams")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 p-10 text-white">
        <h1 className="text-3xl font-bold text-red-400">
          Erro ao carregar times
        </h1>

        <p>{error.message}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <h1 className="mb-8 text-4xl font-bold">
        Times FM2026
      </h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
        {teams?.map((team) => (
          <div
            key={team.id}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                {team.logo_url ? (
                  <img
                    src={team.logo_url}
                    alt={`Escudo do ${team.name}`}
                    className="h-full w-full object-contain p-1.5"
                  />
                ) : (
                  <span className="text-xl">
                    ⚽
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-bold">
                {team.name}
              </h2>
            </div>

            <p className="mt-4 font-semibold text-green-400">
              Saldo: R${" "}
              {Number(team.budget).toLocaleString(
                "pt-BR"
              )}
            </p>

            <p className="mt-2 text-slate-400">
              País: {team.country || "Brasil"}
            </p>

            <a
              href={`/teams/${team.id}`}
              className="mt-5 inline-block rounded-lg bg-blue-600 px-4 py-2 font-semibold transition hover:bg-blue-700"
            >
              Ver elenco
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}