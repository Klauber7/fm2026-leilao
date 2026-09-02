"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import Link from "next/link";

import { supabase } from "@/lib/supabase";


type Player = {
  id: number;
  unique_id: string | null;
  name: string;
  age: number | null;
  position: string | null;
  nationality: string | null;
  ca: number | null;
  club: string | null;
  team_id: number | null;
};


type Team = {
  id: number;
  name: string;
  budget: number | null;
  manager_name: string | null;
};


function money(
  value: number | null | undefined
) {
  return Number(value || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }
  );
}


export default function AdminDraftPage() {
  const router = useRouter();


  const [isAdmin, setIsAdmin] =
    useState(false);


  const [loadingPage, setLoadingPage] =
    useState(true);


  const [teams, setTeams] =
    useState<Team[]>([]);


  const [players, setPlayers] =
    useState<Player[]>([]);


  const [
    selectedPlayer,
    setSelectedPlayer,
  ] =
    useState<Player | null>(null);


  const [selectedTeamId, setSelectedTeamId] =
    useState("");


  const [search, setSearch] =
    useState("");


  const [amount, setAmount] =
    useState("");


  const [transferType, setTransferType] =
    useState<"free" | "paid">("free");


  const [searching, setSearching] =
    useState(false);


  const [saving, setSaving] =
    useState(false);


  const [freePlayersCount, setFreePlayersCount] =
    useState(0);


  const currentTeam = useMemo(() => {
    if (!selectedPlayer?.team_id) {
      return null;
    }

    return (
      teams.find(
        (team) =>
          team.id === selectedPlayer.team_id
      ) || null
    );
  }, [
    selectedPlayer,
    teams,
  ]);


  const destinationTeam = useMemo(() => {
    const id = Number(selectedTeamId);

    if (!id) {
      return null;
    }

    return (
      teams.find(
        (team) => team.id === id
      ) || null
    );
  }, [
    selectedTeamId,
    teams,
  ]);


  const loadPage =
    useCallback(async () => {
      setLoadingPage(true);


      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();


      if (userError || !user) {
        router.replace("/login");
        return;
      }


      const {
        data: adminData,
        error: adminError,
      } =
        await supabase
          .from("admin_users")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();


      if (adminError) {
        console.error(
          "Erro ao verificar ADM:",
          adminError
        );

        alert(
          "Não foi possível verificar sua permissão."
        );

        router.replace("/dashboard");

        return;
      }


      if (!adminData) {
        alert(
          "Você não possui acesso administrativo."
        );

        router.replace("/dashboard");

        return;
      }


      setIsAdmin(true);


      const [
        teamsResponse,
        freePlayersResponse,
      ] =
        await Promise.all([
          supabase
            .from("teams")
            .select(
              `
              id,
              name,
              budget,
              manager_name
              `
            )
            .order("name", {
              ascending: true,
            }),

          supabase
            .from("players")
            .select(
              "id",
              {
                count: "exact",
                head: true,
              }
            )
            .is("team_id", null),
        ]);


      if (teamsResponse.error) {
        console.error(
          "Erro ao carregar clubes:",
          teamsResponse.error
        );

        alert(
          "Não foi possível carregar os clubes."
        );

        setLoadingPage(false);

        return;
      }


      setTeams(
        (teamsResponse.data || []) as Team[]
      );

      setFreePlayersCount(
        freePlayersResponse.count || 0
      );


      setLoadingPage(false);
    }, [router]);


  useEffect(() => {
    loadPage();
  }, [loadPage]);


  async function searchPlayers() {
    const cleanSearch =
      search.trim();


    if (
      cleanSearch.length < 2
    ) {
      alert(
        "Digite pelo menos 2 caracteres."
      );

      return;
    }


    setSearching(true);


    const {
      data,
      error,
    } =
      await supabase
        .from("players")
        .select(
          `
          id,
          unique_id,
          name,
          age,
          position,
          nationality,
          ca,
          club,
          team_id
          `
        )
        .ilike(
          "name",
          `%${cleanSearch}%`
        )
        .order("ca", {
          ascending: false,
          nullsFirst: false,
        })
        .limit(50);


    setSearching(false);


    if (error) {
      console.error(
        "Erro na busca:",
        error
      );

      alert(
        "Erro ao buscar jogadores."
      );

      return;
    }


    setPlayers(
      (data || []) as Player[]
    );
  }


  function selectPlayer(
    player: Player
  ) {
    setSelectedPlayer(player);

    setPlayers([]);

    setSearch(player.name);
  }


  async function transferPlayer() {
    if (!selectedPlayer) {
      alert(
        "Escolha um jogador."
      );

      return;
    }


    const teamId =
      Number(selectedTeamId);


    if (
      !Number.isInteger(teamId) ||
      teamId <= 0
    ) {
      alert(
        "Escolha o clube de destino."
      );

      return;
    }


    if (
      selectedPlayer.team_id !== null &&
      selectedPlayer.team_id === teamId
    ) {
      alert(
        "Esse jogador já pertence ao clube selecionado."
      );

      return;
    }


    let finalAmount = 0;


    if (
      transferType === "paid"
    ) {
      finalAmount =
        Number(amount);


      if (
        !Number.isFinite(
          finalAmount
        ) ||
        finalAmount <= 0
      ) {
        alert(
          "Digite um valor válido."
        );

        return;
      }
    }


    if (
      destinationTeam &&
      finalAmount >
        Number(
          destinationTeam.budget ||
          0
        )
    ) {
      alert(
        `O ${destinationTeam.name} possui apenas ${money(
          destinationTeam.budget
        )} disponíveis.`
      );

      return;
    }


    const confirmed =
      window.confirm(
        transferType === "free"
          ? `Transferir ${selectedPlayer.name} para ${destinationTeam?.name} sem custo?`
          : `Transferir ${selectedPlayer.name} para ${destinationTeam?.name} por ${money(
              finalAmount
            )}?`
      );


    if (!confirmed) {
      return;
    }


    setSaving(true);


    const {
      data,
      error,
    } =
      await supabase.rpc(
        "admin_draft_transfer",
        {
          p_player_id:
            selectedPlayer.id,

          p_team_id:
            teamId,

          p_amount:
            finalAmount,
        }
      );


    setSaving(false);


    if (error) {
      console.error(
        "Erro na transferência:",
        error
      );


      if (
        error.message.includes(
          "NOT_ADMIN"
        )
      ) {
        alert(
          "Você não possui permissão de ADM."
        );

        return;
      }


      if (
        error.message.includes(
          "PLAYER_NOT_FOUND"
        )
      ) {
        alert(
          "Jogador não encontrado."
        );

        return;
      }


      if (
        error.message.includes(
          "TEAM_NOT_FOUND"
        )
      ) {
        alert(
          "Clube não encontrado."
        );

        return;
      }


      if (
        error.message.includes(
          "PLAYER_ALREADY_IN_TEAM"
        )
      ) {
        alert(
          "Esse jogador já pertence ao clube selecionado."
        );

        return;
      }


      if (
        error.message.includes(
          "INSUFFICIENT_BUDGET"
        )
      ) {
        alert(
          "O clube não possui orçamento suficiente."
        );

        return;
      }


      alert(
        error.message
      );

      return;
    }


    console.log(
      "Transferência:",
      data
    );


    alert(
      `${selectedPlayer.name} transferido para ${destinationTeam?.name} com sucesso!`
    );


    setSelectedPlayer(null);

    setSearch("");

    setPlayers([]);

    setSelectedTeamId("");

    setAmount("");

    setTransferType("free");


    await loadPage();
  }


  if (loadingPage) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-400 font-bold">
          Verificando acesso administrativo...
        </p>
      </main>
    );
  }


  if (!isAdmin) {
    return null;
  }


  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <header>
            <p className="font-bold uppercase tracking-widest text-orange-400">
              Área administrativa
            </p>

            <h1 className="mt-2 text-5xl font-black">
              🎯 Admin Draft
            </h1>

            <p className="mt-3 max-w-3xl text-zinc-400">
              Ferramenta administrativa para colocar jogadores nos clubes durante o draft ou fazer correções manuais.
            </p>
          </header>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-black text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              ← Administração
            </Link>

            <Link
              href="/teams"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-black text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              🏟️ Clubes
            </Link>
          </div>
        </div>


        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Clubes
            </p>

            <p className="mt-2 text-3xl font-black text-orange-400">
              {teams.length}
            </p>
          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Jogadores sem clube
            </p>

            <p className="mt-2 text-3xl font-black text-green-400">
              {freePlayersCount.toLocaleString("pt-BR")}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Função
            </p>

            <p className="mt-2 text-xl font-black text-blue-400">
              Draft / Correção
            </p>
          </div>
        </section>


        <section className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5">
          <p className="font-black text-yellow-400">
            ⚠️ Ferramenta administrativa
          </p>

          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Esta página transfere o jogador diretamente. Use somente para escolhas oficiais do draft ou correções do administrador.
          </p>
        </section>


        {/* BUSCAR JOGADOR */}

        <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

          <h2 className="text-2xl font-black">
            1. Escolher jogador
          </h2>


          <div className="mt-5 flex flex-col gap-3 md:flex-row">

            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(
                  event.target.value
                );

                setSelectedPlayer(
                  null
                );
              }}
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  searchPlayers();
                }
              }}
              placeholder="Buscar jogador..."
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-green-500"
            />


            <button
              type="button"
              onClick={
                searchPlayers
              }
              disabled={
                searching
              }
              className="rounded-xl bg-green-600 px-8 py-3 font-black hover:bg-green-500 disabled:opacity-50"
            >
              {searching
                ? "Buscando..."
                : "Buscar"}
            </button>

          </div>


          {players.length > 0 && (
            <div className="mt-5 max-h-96 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950">

              {players.map(
                (player) => (
                  <button
                    key={
                      player.id
                    }
                    type="button"
                    onClick={() =>
                      selectPlayer(
                        player
                      )
                    }
                    className="flex w-full items-center justify-between gap-5 border-b border-zinc-800 px-5 py-4 text-left transition last:border-b-0 hover:bg-zinc-900"
                  >
                    <div>
                      <p className="font-black">
                        {player.name}
                      </p>

                      <p className="mt-1 text-sm text-zinc-500">
                        {player.position ||
                          "-"}{" "}
                        •{" "}
                        {player.nationality ||
                          "-"}{" "}
                        •{" "}
                        {player.age ??
                          "-"}{" "}
                        anos
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-black text-green-400">
                        CA{" "}
                        {player.ca ??
                          "-"}
                      </p>

                      <p className="mt-1 text-xs text-zinc-500">
                        ID{" "}
                        {player.unique_id ||
                          player.id}
                      </p>
                    </div>
                  </button>
                )
              )}

            </div>
          )}

        </section>


        {/* JOGADOR SELECIONADO */}

        {selectedPlayer && (
          <section className="mt-6 rounded-2xl border border-green-500/30 bg-green-500/5 p-6">

            <p className="text-sm font-black uppercase tracking-widest text-green-400">
              Jogador selecionado
            </p>

            <h2 className="mt-2 text-3xl font-black">
              {selectedPlayer.name}
            </h2>

            <p className="mt-3 text-zinc-400">
              {selectedPlayer.position ||
                "-"}{" "}
              • CA{" "}
              {selectedPlayer.ca ??
                "-"}{" "}
              •{" "}
              {selectedPlayer.age ??
                "-"}{" "}
              anos
            </p>

            <p className="mt-2 text-zinc-400">
              Clube atual:{" "}
              <span className="font-bold text-white">
                {currentTeam
                  ? currentTeam.name
                  : "Sem clube"}
              </span>
            </p>

          </section>
        )}


        {/* DESTINO */}

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

          <h2 className="text-2xl font-black">
            2. Clube de destino
          </h2>


          <select
            value={
              selectedTeamId
            }
            onChange={(event) =>
              setSelectedTeamId(
                event.target
                  .value
              )
            }
            className="mt-5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 outline-none focus:border-green-500"
          >

            <option value="">
              Escolha um clube
            </option>

            {teams.map(
              (team) => (
                <option
                  key={team.id}
                  value={team.id}
                >
                  {team.name} —{" "}
                  {money(
                    team.budget
                  )}
                </option>
              )
            )}

          </select>


          {destinationTeam && (
            <div className="mt-4 rounded-xl bg-zinc-950 p-4">

              <p className="font-black">
                {
                  destinationTeam.name
                }
              </p>

              <p className="mt-1 text-green-400">
                Orçamento:{" "}
                {money(
                  destinationTeam.budget
                )}
              </p>

              <p className="mt-1 text-sm text-zinc-500">
                Presidente:{" "}
                {destinationTeam.manager_name ||
                  "Não definido"}
              </p>

            </div>
          )}

        </section>


        {/* CUSTO */}

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

          <h2 className="text-2xl font-black">
            3. Tipo da transferência
          </h2>


          <div className="mt-5 grid gap-4 md:grid-cols-2">

            <button
              type="button"
              onClick={() => {
                setTransferType(
                  "free"
                );

                setAmount("");
              }}
              className={`rounded-xl border p-5 text-left ${
                transferType ===
                "free"
                  ? "border-green-500 bg-green-500/10"
                  : "border-zinc-700 bg-zinc-950"
              }`}
            >
              <p className="text-xl font-black">
                Grátis
              </p>

              <p className="mt-2 text-sm text-zinc-400">
                Não altera o orçamento do clube.
              </p>
            </button>


            <button
              type="button"
              onClick={() =>
                setTransferType(
                  "paid"
                )
              }
              className={`rounded-xl border p-5 text-left ${
                transferType ===
                "paid"
                  ? "border-yellow-500 bg-yellow-500/10"
                  : "border-zinc-700 bg-zinc-950"
              }`}
            >
              <p className="text-xl font-black">
                Com custo
              </p>

              <p className="mt-2 text-sm text-zinc-400">
                O valor será descontado do orçamento.
              </p>
            </button>

          </div>


          {transferType ===
            "paid" && (
            <div className="mt-5">

              <label className="mb-2 block font-bold text-zinc-400">
                Valor da transferência
              </label>

              <input
                type="number"
                min="1"
                value={amount}
                onChange={(
                  event
                ) =>
                  setAmount(
                    event.target
                      .value
                  )
                }
                placeholder="Ex: 5000000"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 outline-none focus:border-yellow-500"
              />

            </div>
          )}

        </section>


        {/* CONFIRMAR */}

        <section className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/5 p-6">

          <h2 className="text-2xl font-black">
            4. Confirmar
          </h2>


          <div className="mt-5 space-y-2 text-zinc-300">

            <p>
              Jogador:{" "}
              <strong>
                {selectedPlayer?.name ||
                  "Não selecionado"}
              </strong>
            </p>

            <p>
              Origem:{" "}
              <strong>
                {currentTeam?.name ||
                  "Sem clube"}
              </strong>
            </p>

            <p>
              Destino:{" "}
              <strong>
                {destinationTeam?.name ||
                  "Não selecionado"}
              </strong>
            </p>

            <p>
              Custo:{" "}
              <strong className="text-green-400">
                {transferType ===
                "free"
                  ? "Grátis"
                  : money(
                      Number(
                        amount ||
                          0
                      )
                    )}
              </strong>
            </p>

          </div>


          <button
            type="button"
            onClick={
              transferPlayer
            }
            disabled={
              saving ||
              !selectedPlayer ||
              !destinationTeam
            }
            className="mt-6 w-full rounded-xl bg-orange-600 px-6 py-4 text-lg font-black transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {saving
              ? "Transferindo..."
              : "TRANSFERIR JOGADOR"}
          </button>

        </section>

        <section className="mt-10 grid gap-3 md:grid-cols-3">
          <Link
            href="/admin/teams"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            🏟️ Administrar clubes
          </Link>

          <Link
            href="/admin/transfers"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            🔄 Auditoria de transferências
          </Link>

          <Link
            href="/bid"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            📢 BID
          </Link>
        </section>

      </div>
    </main>
  );
}