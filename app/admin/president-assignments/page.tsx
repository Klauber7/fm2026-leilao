"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Team = {
  id: number;
  name: string;
  manager_id: string | null;
  manager_name: string | null;
};

type President = {
  userId: string;
  email: string;
  name: string;
  currentTeamId: number | null;
  currentTeamName: string | null;
};

export default function PresidentAssignmentsPage() {
  const router = useRouter();

  const [presidents, setPresidents] = useState<President[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      router.replace("/login");
      return null;
    }

    return session.access_token;
  }, [router]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const token = await getToken();
      if (!token) return;

      const response = await fetch("/api/admin/presidents/assign", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (response.status === 403) {
          router.replace("/dashboard");
          return;
        }

        throw new Error(data?.error || "Não foi possível carregar os dados.");
      }

      setPresidents(data?.presidents || []);
      setTeams(data?.teams || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível carregar os dados."
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedPresident = useMemo(
    () => presidents.find((item) => item.userId === selectedUserId) || null,
    [presidents, selectedUserId]
  );

  const selectedTeam = useMemo(
    () => teams.find((item) => String(item.id) === selectedTeamId) || null,
    [teams, selectedTeamId]
  );

  const availableTeams = useMemo(() => {
    if (!selectedPresident) {
      return teams.filter((team) => !team.manager_id);
    }

    return teams.filter(
      (team) =>
        !team.manager_id || team.manager_id === selectedPresident.userId
    );
  }, [teams, selectedPresident]);

  async function assignPresident() {
    if (!selectedPresident || !selectedTeam) {
      setError("Selecione o presidente e o time.");
      return;
    }

    const confirmed = window.confirm(
      selectedPresident.currentTeamName
        ? `Mover ${selectedPresident.name} de ${selectedPresident.currentTeamName} para ${selectedTeam.name}?`
        : `Atribuir ${selectedPresident.name} ao ${selectedTeam.name}?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const token = await getToken();
      if (!token) return;

      const response = await fetch("/api/admin/presidents/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: selectedPresident.userId,
          teamId: selectedTeam.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível atribuir o presidente.");
      }

      setMessage(
        `${selectedPresident.name} agora está vinculado ao ${selectedTeam.name}.`
      );
      setSelectedTeamId("");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível atribuir o presidente."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removePresidentFromTeam(president: President) {
    if (!president.currentTeamId) return;

    const confirmed = window.confirm(
      `Remover ${president.name} do ${president.currentTeamName}? A conta continuará ativa, apenas ficará sem clube.`
    );

    if (!confirmed) return;

    try {
      setProcessingUserId(president.userId);
      setError("");
      setMessage("");

      const token = await getToken();
      if (!token) return;

      const response = await fetch("/api/admin/presidents/assign", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: president.userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível remover do time.");
      }

      setMessage(`${president.name} agora está sem clube.`);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível remover do time."
      );
    } finally {
      setProcessingUserId(null);
    }
  }

  async function deletePresident(president: President) {
    const firstConfirm = window.confirm(
      `ATENÇÃO: excluir permanentemente a conta de ${president.name}?`
    );

    if (!firstConfirm) return;

    const typed = window.prompt(
      `Para confirmar a exclusão permanente, digite EXCLUIR`
    );

    if (typed !== "EXCLUIR") {
      setError("Exclusão cancelada. Era necessário digitar EXCLUIR.");
      return;
    }

    try {
      setProcessingUserId(president.userId);
      setError("");
      setMessage("");

      const token = await getToken();
      if (!token) return;

      const response = await fetch("/api/admin/presidents/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: president.userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível excluir o presidente.");
      }

      setMessage(`${president.name} foi excluído permanentemente.`);
      if (selectedUserId === president.userId) {
        setSelectedUserId("");
        setSelectedTeamId("");
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível excluir o presidente."
      );
    } finally {
      setProcessingUserId(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <p className="font-bold text-zinc-400">Carregando presidentes...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-400">
              Administração
            </p>
            <h1 className="mt-2 text-4xl font-black md:text-5xl">
              👤 Gerenciar Presidentes
            </h1>
            <p className="mt-3 max-w-3xl text-zinc-400">
              Atribua times, remova do clube ou exclua permanentemente uma conta de presidente.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/admin/administrators")}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-center font-black transition hover:bg-zinc-800"
          >
            ← Permissões
          </button>
        </div>

        {error && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 font-bold text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-8 rounded-2xl border border-green-500/30 bg-green-500/10 p-5 font-bold text-green-300">
            {message}
          </div>
        )}

        <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-black text-zinc-400">
                Presidente
              </label>
              <select
                value={selectedUserId}
                onChange={(event) => {
                  setSelectedUserId(event.target.value);
                  setSelectedTeamId("");
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 font-black outline-none focus:border-cyan-500"
              >
                <option value="">Selecione um presidente</option>
                {presidents.map((president) => (
                  <option key={president.userId} value={president.userId}>
                    {president.name}
                    {president.currentTeamName
                      ? ` — ${president.currentTeamName}`
                      : " — SEM TIME"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-zinc-400">
                Time / Vaga
              </label>
              <select
                value={selectedTeamId}
                disabled={!selectedPresident}
                onChange={(event) => setSelectedTeamId(event.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 font-black outline-none focus:border-cyan-500 disabled:opacity-50"
              >
                <option value="">Selecione um time livre</option>
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                    {team.manager_id === selectedPresident?.userId
                      ? " — ATUAL"
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={assignPresident}
            disabled={saving || !selectedPresident || !selectedTeam}
            className="mt-6 w-full rounded-xl bg-cyan-600 px-5 py-4 text-lg font-black transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Atribuir Presidente"}
          </button>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-zinc-800 bg-zinc-950/60">
                <tr className="text-left text-xs font-black uppercase tracking-widest text-zinc-500">
                  <th className="px-6 py-4">Presidente</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Time atual</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {presidents.map((president) => {
                  const processing = processingUserId === president.userId;

                  return (
                    <tr
                      key={president.userId}
                      className="border-b border-zinc-800/80 last:border-b-0"
                    >
                      <td className="px-6 py-5 font-black">{president.name}</td>
                      <td className="px-6 py-5 text-zinc-400">{president.email}</td>
                      <td className="px-6 py-5 font-bold text-zinc-300">
                        {president.currentTeamName || "SEM TIME"}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={processing || !president.currentTeamId}
                            onClick={() => removePresidentFromTeam(president)}
                            className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 font-black text-yellow-300 transition hover:bg-yellow-500/20 disabled:opacity-40"
                          >
                            Remover do time
                          </button>

                          <button
                            type="button"
                            disabled={processing}
                            onClick={() => deletePresident(president)}
                            className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 font-black text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
                          >
                            {processing ? "Processando..." : "Excluir Presidente"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {presidents.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-12 text-center text-zinc-500"
                    >
                      Nenhum presidente encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
