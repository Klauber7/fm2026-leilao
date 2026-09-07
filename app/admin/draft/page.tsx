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

type DraftMode = "players" | "staff";
type TransferType = "free" | "paid" | "staff100" | "staff75" | "staff50" | "staff25";

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

type Coach = {
  id: number;
  name: string;
  age: number | null;
  role: string | null;
  nationality: string | null;
  ca: number | null;
  pa: number | null;
  value: number | null;
  team_id: number | null;
  hired_at: string | null;
};

type Team = {
  id: number;
  name: string;
  budget: number | null;
  manager_name: string | null;
};

function money(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function getStaffPercentage(
  transferType: TransferType
): number | null {
  if (transferType === "staff100") return 1;
  if (transferType === "staff75") return 0.75;
  if (transferType === "staff50") return 0.5;
  if (transferType === "staff25") return 0.25;
  return null;
}

export default function AdminDraftPage() {
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);

  const [mode, setMode] = useState<DraftMode>("players");
  const [teams, setTeams] = useState<Team[]>([]);

  const [players, setPlayers] = useState<Player[]>([]);
  const [staff, setStaff] = useState<Coach[]>([]);

  const [selectedPlayer, setSelectedPlayer] =
    useState<Player | null>(null);
  const [selectedCoach, setSelectedCoach] =
    useState<Coach | null>(null);

  const [selectedTeamId, setSelectedTeamId] =
    useState("");
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [transferType, setTransferType] =
    useState<TransferType>("free");

  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const [freePlayersCount, setFreePlayersCount] =
    useState(0);
  const [freeStaffCount, setFreeStaffCount] =
    useState(0);

  const selectedItem =
    mode === "players" ? selectedPlayer : selectedCoach;

  const currentTeam = useMemo(() => {
    const teamId =
      mode === "players"
        ? selectedPlayer?.team_id
        : selectedCoach?.team_id;

    if (!teamId) return null;

    return (
      teams.find((team) => team.id === teamId) || null
    );
  }, [mode, selectedPlayer, selectedCoach, teams]);

  const destinationTeam = useMemo(() => {
    const id = Number(selectedTeamId);

    if (!id) return null;

    return teams.find((team) => team.id === id) || null;
  }, [selectedTeamId, teams]);

  const resetSelection = useCallback(() => {
    setPlayers([]);
    setStaff([]);
    setSelectedPlayer(null);
    setSelectedCoach(null);
    setSelectedTeamId("");
    setSearch("");
    setAmount("");
    setTransferType("free");
  }, []);

  const changeMode = (nextMode: DraftMode) => {
    if (saving) return;
    setMode(nextMode);
    resetSelection();
    setTransferType("free");
  };

  const loadPage = useCallback(async () => {
    setLoadingPage(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    const {
      data: adminData,
      error: adminError,
    } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError) {
      console.error("Erro ao verificar ADM:", adminError);
      alert("Não foi possível verificar sua permissão.");
      router.replace("/dashboard");
      return;
    }

    if (!adminData) {
      alert("Você não possui acesso administrativo.");
      router.replace("/dashboard");
      return;
    }

    setIsAdmin(true);

    const [
      teamsResponse,
      freePlayersResponse,
      freeStaffResponse,
    ] = await Promise.all([
      supabase
        .from("teams")
        .select(`
          id,
          name,
          budget,
          manager_name
        `)
        .order("name", { ascending: true }),

      supabase
        .from("players")
        .select("id", {
          count: "exact",
          head: true,
        })
        .is("team_id", null),

      supabase
        .from("coaches")
        .select("id", {
          count: "exact",
          head: true,
        })
        .is("team_id", null),
    ]);

    if (teamsResponse.error) {
      console.error(
        "Erro ao carregar clubes:",
        teamsResponse.error
      );
      alert("Não foi possível carregar os clubes.");
      setLoadingPage(false);
      return;
    }

    if (freePlayersResponse.error) {
      console.error(
        "Erro ao contar jogadores:",
        freePlayersResponse.error
      );
    }

    if (freeStaffResponse.error) {
      console.error(
        "Erro ao contar staff:",
        freeStaffResponse.error
      );
    }

    setTeams((teamsResponse.data || []) as Team[]);
    setFreePlayersCount(freePlayersResponse.count || 0);
    setFreeStaffCount(freeStaffResponse.count || 0);
    setLoadingPage(false);
  }, [router]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  async function searchItems() {
    const cleanSearch = search.trim();

    if (cleanSearch.length < 2) {
      alert("Digite pelo menos 2 caracteres.");
      return;
    }

    setSearching(true);

    if (mode === "players") {
      const { data, error } = await supabase
        .from("players")
        .select(`
          id,
          unique_id,
          name,
          age,
          position,
          nationality,
          ca,
          club,
          team_id
        `)
        .ilike("name", `%${cleanSearch}%`)
        .order("ca", {
          ascending: false,
          nullsFirst: false,
        })
        .limit(50);

      setSearching(false);

      if (error) {
        console.error("Erro na busca:", error);
        alert("Erro ao buscar jogadores.");
        return;
      }

      setPlayers((data || []) as Player[]);
      setStaff([]);
      return;
    }

    const { data, error } = await supabase
      .from("coaches")
      .select(`
        id,
        name,
        age,
        role,
        nationality,
        ca,
        pa,
        value,
        team_id,
        hired_at
      `)
      .ilike("name", `%${cleanSearch}%`)
      .order("ca", {
        ascending: false,
        nullsFirst: false,
      })
      .order("name", {
        ascending: true,
      })
      .limit(50);

    setSearching(false);

    if (error) {
      console.error("Erro na busca de staff:", error);
      alert("Erro ao buscar membros do staff.");
      return;
    }

    setStaff((data || []) as Coach[]);
    setPlayers([]);
  }

  function selectPlayer(player: Player) {
    setSelectedPlayer(player);
    setSelectedCoach(null);
    setPlayers([]);
    setStaff([]);
    setSearch(player.name);
  }

  function selectCoach(coach: Coach) {
    setSelectedCoach(coach);
    setSelectedPlayer(null);
    setPlayers([]);
    setStaff([]);
    setSearch(coach.name);
  }

  async function transferSelected() {
    if (!selectedItem) {
      alert(
        mode === "players"
          ? "Escolha um jogador."
          : "Escolha um membro do staff."
      );
      return;
    }

    const teamId = Number(selectedTeamId);

    if (!Number.isInteger(teamId) || teamId <= 0) {
      alert("Escolha o clube de destino.");
      return;
    }

    if (
      selectedItem.team_id !== null &&
      selectedItem.team_id === teamId
    ) {
      alert(
        mode === "players"
          ? "Esse jogador já pertence ao clube selecionado."
          : "Esse membro do staff já pertence ao clube selecionado."
      );
      return;
    }

    let finalAmount = 0;

    if (transferType === "paid") {
      finalAmount = Number(amount);

      if (
        !Number.isFinite(finalAmount) ||
        finalAmount <= 0
      ) {
        alert("Digite um valor válido.");
        return;
      }
    }

    const staffPercentage = getStaffPercentage(transferType);

    if (staffPercentage !== null) {
      if (mode !== "staff" || !selectedCoach) {
        alert("Essa opção é exclusiva para o Draft de Staff.");
        return;
      }

      const staffValue = Number(selectedCoach.value || 0);

      if (!Number.isFinite(staffValue) || staffValue <= 0) {
        alert("Esse membro do staff não possui valor cadastrado.");
        return;
      }

      finalAmount = Math.round(staffValue * staffPercentage);
    }

    if (
      destinationTeam &&
      finalAmount > Number(destinationTeam.budget || 0)
    ) {
      alert(
        `O ${destinationTeam.name} possui apenas ${money(
          destinationTeam.budget
        )} disponíveis.`
      );
      return;
    }

    const label =
      mode === "players" ? "jogador" : "staff";

    const confirmed = window.confirm(
      transferType === "free"
        ? `Transferir ${selectedItem.name} para ${destinationTeam?.name} sem custo?`
        : `Transferir ${selectedItem.name} para ${destinationTeam?.name} por ${money(
            finalAmount
          )}?`
    );

    if (!confirmed) return;

    setSaving(true);

    const rpcName =
      mode === "players"
        ? "admin_draft_transfer"
        : "admin_draft_staff_transfer";

    const rpcParams =
      mode === "players"
        ? {
            p_player_id: selectedPlayer!.id,
            p_team_id: teamId,
            p_amount: finalAmount,
          }
        : {
            p_coach_id: selectedCoach!.id,
            p_team_id: teamId,
            p_amount: finalAmount,
          };

    const { data, error } = await supabase.rpc(
      rpcName,
      rpcParams
    );

    setSaving(false);

    if (error) {
      console.error(
        `Erro na transferência de ${label}:`,
        error
      );

      const message = error.message || "";

      if (message.includes("NOT_ADMIN")) {
        alert("Você não possui permissão de ADM.");
        return;
      }

      if (message.includes("PLAYER_NOT_FOUND")) {
        alert("Jogador não encontrado.");
        return;
      }

      if (message.includes("COACH_NOT_FOUND")) {
        alert("Membro do staff não encontrado.");
        return;
      }

      if (message.includes("TEAM_NOT_FOUND")) {
        alert("Clube não encontrado.");
        return;
      }

      if (message.includes("PLAYER_ALREADY_IN_TEAM")) {
        alert(
          "Esse jogador já pertence ao clube selecionado."
        );
        return;
      }

      if (message.includes("COACH_ALREADY_IN_TEAM")) {
        alert(
          "Esse membro do staff já pertence ao clube selecionado."
        );
        return;
      }

      if (message.includes("INSUFFICIENT_BUDGET")) {
        alert(
          "O clube não possui orçamento suficiente."
        );
        return;
      }

      alert(message);
      return;
    }

    console.log("Transferência:", data);

    alert(
      `${selectedItem.name} transferido para ${destinationTeam?.name} com sucesso!`
    );

    resetSelection();
    await loadPage();
  }

  if (loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <p className="font-bold text-zinc-400">
          Verificando acesso administrativo...
        </p>
      </main>
    );
  }

  if (!isAdmin) return null;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <header>
            <p className="font-bold uppercase tracking-widest text-orange-400">
              Área administrativa
            </p>

            <h1 className="mt-2 text-4xl font-black sm:text-5xl">
              🎯 Admin Draft
            </h1>

            <p className="mt-3 max-w-3xl text-zinc-400">
              Controle o Draft de Jogadores e o Draft de
              Staff na mesma área.
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

        {/* ABAS */}
        <section className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => changeMode("players")}
            className={`rounded-2xl border p-5 text-left transition ${
              mode === "players"
                ? "border-orange-500 bg-orange-500/10"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Draft
            </p>
            <p className="mt-2 text-2xl font-black">
              ⚽ Jogadores
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Escolha jogadores e envie diretamente para os
              clubes.
            </p>
          </button>

          <button
            type="button"
            onClick={() => changeMode("staff")}
            className={`rounded-2xl border p-5 text-left transition ${
              mode === "staff"
                ? "border-purple-500 bg-purple-500/10"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Draft
            </p>
            <p className="mt-2 text-2xl font-black">
              👔 Staff
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Treinadores, adjuntos, preparadores,
              fisioterapeutas e demais profissionais.
            </p>
          </button>
        </section>

        {/* RESUMO */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              Jogadores livres
            </p>
            <p className="mt-2 text-3xl font-black text-green-400">
              {freePlayersCount.toLocaleString("pt-BR")}
            </p>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Staff livre
            </p>
            <p className="mt-2 text-3xl font-black text-purple-400">
              {freeStaffCount.toLocaleString("pt-BR")}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Modo atual
            </p>
            <p className="mt-2 text-xl font-black text-blue-400">
              {mode === "players"
                ? "Draft de Jogadores"
                : "Draft de Staff"}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5">
          <p className="font-black text-yellow-400">
            ⚠️ Ferramenta administrativa
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            A transferência é feita diretamente para o clube.
            Use somente para escolhas oficiais do draft ou
            correções administrativas.
          </p>
        </section>

        {/* BUSCA */}
        <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-2xl font-black">
            1.{" "}
            {mode === "players"
              ? "Escolher jogador"
              : "Escolher membro do staff"}
          </h2>

          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedPlayer(null);
                setSelectedCoach(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  searchItems();
                }
              }}
              placeholder={
                mode === "players"
                  ? "Buscar jogador..."
                  : "Buscar staff..."
              }
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-green-500"
            />

            <button
              type="button"
              onClick={searchItems}
              disabled={searching}
              className={`rounded-xl px-8 py-3 font-black disabled:opacity-50 ${
                mode === "players"
                  ? "bg-green-600 hover:bg-green-500"
                  : "bg-purple-600 hover:bg-purple-500"
              }`}
            >
              {searching ? "Buscando..." : "Buscar"}
            </button>
          </div>

          {mode === "players" && players.length > 0 && (
            <div className="mt-5 max-h-96 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950">
              {players.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => selectPlayer(player)}
                  className="flex w-full items-center justify-between gap-5 border-b border-zinc-800 px-5 py-4 text-left transition last:border-b-0 hover:bg-zinc-900"
                >
                  <div>
                    <p className="font-black">
                      {player.name}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {player.position || "-"} •{" "}
                      {player.nationality || "-"} •{" "}
                      {player.age ?? "-"} anos
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-black text-green-400">
                      CA {player.ca ?? "-"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      ID {player.unique_id || player.id}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {mode === "staff" && staff.length > 0 && (
            <div className="mt-5 max-h-96 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950">
              {staff.map((coach) => (
                <button
                  key={coach.id}
                  type="button"
                  onClick={() => selectCoach(coach)}
                  className="flex w-full items-center justify-between gap-5 border-b border-zinc-800 px-5 py-4 text-left transition last:border-b-0 hover:bg-zinc-900"
                >
                  <div>
                    <p className="font-black">
                      {coach.name}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {coach.role || "Função não informada"} •{" "}
                      {coach.nationality || "-"} •{" "}
                      {coach.age ?? "-"} anos
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-black text-purple-400">
                      CA {coach.ca ?? "-"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      PA {coach.pa ?? "-"} • ID {coach.id}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* SELECIONADO */}
        {selectedItem && (
          <section
            className={`mt-6 rounded-2xl border p-6 ${
              mode === "players"
                ? "border-green-500/30 bg-green-500/5"
                : "border-purple-500/30 bg-purple-500/5"
            }`}
          >
            <p
              className={`text-sm font-black uppercase tracking-widest ${
                mode === "players"
                  ? "text-green-400"
                  : "text-purple-400"
              }`}
            >
              {mode === "players"
                ? "Jogador selecionado"
                : "Staff selecionado"}
            </p>

            <h2 className="mt-2 text-3xl font-black">
              {selectedItem.name}
            </h2>

            {mode === "players" && selectedPlayer && (
              <p className="mt-3 text-zinc-400">
                {selectedPlayer.position || "-"} • CA{" "}
                {selectedPlayer.ca ?? "-"} •{" "}
                {selectedPlayer.age ?? "-"} anos
              </p>
            )}

            {mode === "staff" && selectedCoach && (
              <p className="mt-3 text-zinc-400">
                {selectedCoach.role || "-"} • CA{" "}
                {selectedCoach.ca ?? "-"} • PA{" "}
                {selectedCoach.pa ?? "-"} •{" "}
                {selectedCoach.age ?? "-"} anos
              </p>
            )}

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
        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-2xl font-black">
            2. Clube de destino
          </h2>

          <select
            value={selectedTeamId}
            onChange={(event) =>
              setSelectedTeamId(event.target.value)
            }
            className="mt-5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 outline-none focus:border-green-500"
          >
            <option value="">Escolha um clube</option>

            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} — {money(team.budget)}
              </option>
            ))}
          </select>

          {destinationTeam && (
            <div className="mt-4 rounded-xl bg-zinc-950 p-4">
              <p className="font-black">
                {destinationTeam.name}
              </p>
              <p className="mt-1 text-green-400">
                Orçamento: {money(destinationTeam.budget)}
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
        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-2xl font-black">
            3. Tipo da transferência
          </h2>

          <div
            className={`mt-5 grid gap-4 ${
              mode === "staff"
                ? "md:grid-cols-3 xl:grid-cols-6"
                : "md:grid-cols-2"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setTransferType("free");
                setAmount("");
              }}
              className={`rounded-xl border p-5 text-left ${
                transferType === "free"
                  ? "border-green-500 bg-green-500/10"
                  : "border-zinc-700 bg-zinc-950"
              }`}
            >
              <p className="text-xl font-black">Grátis</p>
              <p className="mt-2 text-sm text-zinc-400">
                Não altera o orçamento do clube.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setTransferType("paid")}
              className={`rounded-xl border p-5 text-left ${
                transferType === "paid"
                  ? "border-yellow-500 bg-yellow-500/10"
                  : "border-zinc-700 bg-zinc-950"
              }`}
            >
              <p className="text-xl font-black">
                Valor aberto
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                Digite manualmente o valor da transferência.
              </p>
            </button>

            {mode === "staff" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setTransferType("staff100");
                    setAmount("");
                  }}
                  className={`rounded-xl border p-5 text-left ${
                    transferType === "staff100"
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-zinc-700 bg-zinc-950"
                  }`}
                >
                  <p className="text-xl font-black">100%</p>
                  <p className="mt-2 text-sm text-zinc-400">
                    {selectedCoach
                      ? money(selectedCoach.value)
                      : "Valor total do Staff"}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTransferType("staff75");
                    setAmount("");
                  }}
                  className={`rounded-xl border p-5 text-left ${
                    transferType === "staff75"
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-zinc-700 bg-zinc-950"
                  }`}
                >
                  <p className="text-xl font-black">75%</p>
                  <p className="mt-2 text-sm text-zinc-400">
                    {selectedCoach
                      ? money(
                          Math.round(
                            Number(selectedCoach.value || 0) *
                              0.75
                          )
                        )
                      : "75% do valor do Staff"}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTransferType("staff50");
                    setAmount("");
                  }}
                  className={`rounded-xl border p-5 text-left ${
                    transferType === "staff50"
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-zinc-700 bg-zinc-950"
                  }`}
                >
                  <p className="text-xl font-black">50%</p>
                  <p className="mt-2 text-sm text-zinc-400">
                    {selectedCoach
                      ? money(
                          Math.round(
                            Number(selectedCoach.value || 0) *
                              0.5
                          )
                        )
                      : "50% do valor do Staff"}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTransferType("staff25");
                    setAmount("");
                  }}
                  className={`rounded-xl border p-5 text-left ${
                    transferType === "staff25"
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-zinc-700 bg-zinc-950"
                  }`}
                >
                  <p className="text-xl font-black">25%</p>
                  <p className="mt-2 text-sm text-zinc-400">
                    {selectedCoach
                      ? money(
                          Math.round(
                            Number(selectedCoach.value || 0) *
                              0.25
                          )
                        )
                      : "25% do valor do Staff"}
                  </p>
                </button>
              </>
            )}
          </div>

          {transferType === "paid" && (
            <div className="mt-5">
              <label className="mb-2 block font-bold text-zinc-400">
                Valor da transferência
              </label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                placeholder="Ex: 5000000"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 outline-none focus:border-yellow-500"
              />
            </div>
          )}

          {mode === "staff" &&
            getStaffPercentage(transferType) !== null && (
              <div className="mt-5 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                <p className="text-sm font-bold text-zinc-400">
                  Valor base do Staff
                </p>
                <p className="mt-1 text-xl font-black text-white">
                  {money(selectedCoach?.value)}
                </p>
                <p className="mt-3 text-sm font-bold text-zinc-400">
                  Valor que será descontado
                </p>
                <p className="mt-1 text-2xl font-black text-purple-400">
                  {money(
                    Math.round(
                      Number(selectedCoach?.value || 0) *
                        Number(
                          getStaffPercentage(transferType) || 0
                        )
                    )
                  )}
                </p>
              </div>
            )}
        </section>

        {/* CONFIRMAÇÃO */}
        <section className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/5 p-5 sm:p-6">
          <h2 className="text-2xl font-black">
            4. Confirmar
          </h2>

          <div className="mt-5 space-y-2 text-zinc-300">
            <p>
              {mode === "players" ? "Jogador" : "Staff"}:{" "}
              <strong>
                {selectedItem?.name || "Não selecionado"}
              </strong>
            </p>

            <p>
              Origem:{" "}
              <strong>
                {currentTeam?.name || "Sem clube"}
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
                {transferType === "free"
                  ? "Grátis"
                  : transferType === "paid"
                  ? money(Number(amount || 0))
                  : money(
                      Math.round(
                        Number(selectedCoach?.value || 0) *
                          Number(
                            getStaffPercentage(transferType) || 0
                          )
                      )
                    )}
              </strong>
            </p>
          </div>

          <button
            type="button"
            onClick={transferSelected}
            disabled={
              saving ||
              !selectedItem ||
              !destinationTeam
            }
            className={`mt-6 w-full rounded-xl px-6 py-4 text-lg font-black transition disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 ${
              mode === "players"
                ? "bg-orange-600 hover:bg-orange-500"
                : "bg-purple-600 hover:bg-purple-500"
            }`}
          >
            {saving
              ? "Transferindo..."
              : mode === "players"
              ? "TRANSFERIR JOGADOR"
              : "TRANSFERIR STAFF"}
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
            href="/staff"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            👔 Comissão técnica
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
