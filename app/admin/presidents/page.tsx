"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Team = {
  id: number;
  name: string;
  manager_id?: string | null;
  manager_name?: string | null;
};

export default function CreatePresidentPage() {
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teamId, setTeamId] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      router.replace("/login");
      return null;
    }

    return session.access_token;
  }, [router]);

  const loadTeams = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch("/api/admin/presidents", {
        method: "GET",
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

        throw new Error(data?.error || "Não foi possível carregar os times.");
      }

      const freeTeams = (data?.teams || []) as Team[];
      setTeams(freeTeams);

      if (freeTeams.length === 1) {
        setTeamId(String(freeTeams[0].id));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os times livres."
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, router]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const selectedTeam = useMemo(
    () => teams.find((team) => String(team.id) === teamId) || null,
    [teams, teamId]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim() || !email.trim() || !password || !teamId) {
      setError("Preencha todos os campos.");
      return;
    }

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    const confirmed = window.confirm(
      `Criar ${name.trim()} como presidente do ${selectedTeam?.name || "time selecionado"}?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch("/api/admin/presidents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          teamId: Number(teamId),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível criar o presidente.");
      }

      setMessage(
        `${data.president.name} criado com sucesso e vinculado ao ${data.president.teamName}.`
      );

      setName("");
      setEmail("");
      setPassword("");
      setTeamId("");

      await loadTeams();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível criar o presidente."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:px-10">
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="mb-8 text-sm font-bold text-zinc-400 transition hover:text-white"
        >
          ← Administração
        </button>

        <div className="mb-8">
          <p className="text-sm font-black uppercase tracking-[0.24em] text-purple-400">
            Administração
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">
            Criar Presidente
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-400">
            Crie a conta, confirme o email automaticamente e vincule o
            presidente diretamente a um time livre.
          </p>
        </div>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-2xl sm:p-8">
          {loading ? (
            <div className="py-12 text-center font-bold text-zinc-400">
              Carregando times livres...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-black text-zinc-300">
                  Nome do presidente
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex.: Lucas Dinoco"
                  autoComplete="off"
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-4 font-semibold outline-none transition focus:border-purple-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-zinc-300">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="presidente@email.com"
                  autoComplete="off"
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-4 font-semibold outline-none transition focus:border-purple-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-zinc-300">
                  Senha
                </label>

                <div className="flex gap-2">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    className="min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-4 font-semibold outline-none transition focus:border-purple-500"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 font-black text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-zinc-300">
                  Time
                </label>

                <select
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-4 font-black outline-none transition focus:border-purple-500"
                >
                  <option value="">Selecione um time livre</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs font-semibold text-zinc-500">
                  {teams.length} time(s) sem presidente.
                </p>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-bold text-red-300">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 font-bold text-green-300">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={saving || teams.length === 0}
                className="w-full rounded-2xl bg-purple-600 px-5 py-4 text-lg font-black text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Criando..." : "Criar Presidente"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
