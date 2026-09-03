"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AdminRole = "president" | "admin" | "master";

type Team = {
  id: number;
  name: string;
  manager_id: string | null;
  manager_name: string | null;
};

type SiteAdmin = {
  user_id: string;
  role: "admin" | "master";
  is_active: boolean;
};

type PresidentRow = {
  teamId: number;
  clubName: string;
  managerId: string;
  managerName: string;
  role: AdminRole;
};

function roleLabel(role: AdminRole) {
  if (role === "master") return "ADM MASTER";
  if (role === "admin") return "ADM";
  return "PRESIDENTE";
}

function roleClass(role: AdminRole) {
  if (role === "master") {
    return "border-purple-500/30 bg-purple-500/10 text-purple-300";
  }

  if (role === "admin") {
    return "border-green-500/30 bg-green-500/10 text-green-300";
  }

  return "border-zinc-700 bg-zinc-950 text-zinc-300";
}

export default function AdministratorsPage() {
  const router = useRouter();

  const [presidents, setPresidents] = useState<PresidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: myRole, error: roleError } = await supabase.rpc(
        "get_my_admin_role"
      );

      if (roleError) {
        console.error("Erro ao verificar nível administrativo:", roleError);
        setError("Não foi possível verificar seu nível administrativo.");
        return;
      }

      if (myRole !== "master") {
        router.replace("/dashboard");
        return;
      }

      const [teamsResult, adminsResult] = await Promise.all([
        supabase
          .from("teams")
          .select("id, name, manager_id, manager_name")
          .not("manager_id", "is", null)
          .order("name", { ascending: true }),

        supabase
          .from("site_admins")
          .select("user_id, role, is_active"),
      ]);

      if (teamsResult.error) {
        console.error("Erro ao carregar presidentes:", teamsResult.error);
        setError("Não foi possível carregar os presidentes.");
        return;
      }

      if (adminsResult.error) {
        console.error("Erro ao carregar administradores:", adminsResult.error);
        setError("Não foi possível carregar os níveis administrativos.");
        return;
      }

      const adminMap = new Map<string, SiteAdmin>();

      ((adminsResult.data || []) as SiteAdmin[]).forEach((item) => {
        adminMap.set(item.user_id, item);
      });

      const rows = ((teamsResult.data || []) as Team[])
        .filter((team) => Boolean(team.manager_id))
        .map((team) => {
          const managerId = String(team.manager_id);
          const admin = adminMap.get(managerId);

          let role: AdminRole = "president";

          if (admin?.is_active && admin.role === "admin") {
            role = "admin";
          }

          if (admin?.is_active && admin.role === "master") {
            role = "master";
          }

          return {
            teamId: team.id,
            clubName: team.name,
            managerId,
            managerName: team.manager_name || "Presidente",
            role,
          };
        });

      setPresidents(rows);
    } catch (err) {
      console.error(err);
      setError("Ocorreu um erro ao carregar os administradores.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPresidents = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return presidents;
    }

    return presidents.filter((president) =>
      `${president.managerName} ${president.clubName}`
        .toLowerCase()
        .includes(term)
    );
  }, [presidents, search]);

  const counts = useMemo(
    () => ({
      presidents: presidents.filter((item) => item.role === "president").length,
      admins: presidents.filter((item) => item.role === "admin").length,
      masters: presidents.filter((item) => item.role === "master").length,
    }),
    [presidents]
  );

  async function changeRole(
    president: PresidentRow,
    newRole: AdminRole
  ) {
    if (newRole === president.role) return;

    const confirmed = window.confirm(
      `Alterar ${president.managerName} (${president.clubName}) de ${roleLabel(
        president.role
      )} para ${roleLabel(newRole)}?`
    );

    if (!confirmed) return;

    setProcessingId(president.managerId);
    setError("");
    setMessage("");

    const { data, error: rpcError } = await supabase.rpc(
      "set_president_admin_role",
      {
        p_user_id: president.managerId,
        p_role: newRole,
      }
    );

    if (rpcError) {
      const raw = String(rpcError.message || "");
      console.error("Erro ao alterar nível:", rpcError);

      if (raw.includes("MASTER_REQUIRED")) {
        setError("Somente ADM MASTER pode alterar administradores.");
      } else if (raw.includes("TARGET_NOT_PRESIDENT")) {
        setError("Esse usuário não está vinculado a um clube como presidente.");
      } else if (raw.includes("OWNER_PROTECTED")) {
        setError("A conta principal é protegida e não pode ser rebaixada.");
      } else if (raw.includes("INVALID_ROLE")) {
        setError("Nível administrativo inválido.");
      } else {
        setError(raw || "Não foi possível alterar o nível administrativo.");
      }

      setProcessingId(null);
      return;
    }

    const result =
      data && typeof data === "object"
        ? (data as { role?: AdminRole })
        : null;

    setMessage(
      `${president.managerName} agora é ${roleLabel(
        result?.role || newRole
      )}.`
    );

    await loadData();
    setProcessingId(null);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <p className="font-bold text-zinc-400">
          Carregando administradores...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-purple-400">
              Administração
            </p>

            <h1 className="mt-2 text-4xl font-black md:text-5xl">
              👑 Administradores
            </h1>

            <p className="mt-3 max-w-3xl text-zinc-400">
              Escolha entre os presidentes quem será Presidente, ADM ou ADM MASTER.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-center font-black transition hover:bg-zinc-800"
          >
            ← Administração
          </Link>
        </div>

        {error && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-8 rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-green-300">
            {message}
          </div>
        )}

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Presidentes vinculados
            </p>
            <p className="mt-2 text-3xl font-black">{presidents.length}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Presidente
            </p>
            <p className="mt-2 text-3xl font-black text-zinc-300">
              {counts.presidents}
            </p>
          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              ADM
            </p>
            <p className="mt-2 text-3xl font-black text-green-400">
              {counts.admins}
            </p>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              ADM MASTER
            </p>
            <p className="mt-2 text-3xl font-black text-purple-400">
              {counts.masters}
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <label
            htmlFor="admin-search"
            className="mb-2 block text-sm font-black text-zinc-400"
          >
            Buscar presidente ou clube
          </label>

          <input
            id="admin-search"
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ex.: Klauber, Grêmio..."
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition placeholder:text-zinc-600 focus:border-green-500"
          />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-zinc-800 bg-zinc-950/60">
                <tr className="text-left text-xs font-black uppercase tracking-widest text-zinc-500">
                  <th className="px-6 py-4">Presidente</th>
                  <th className="px-6 py-4">Clube</th>
                  <th className="px-6 py-4">Nível atual</th>
                  <th className="px-6 py-4">Alterar nível</th>
                </tr>
              </thead>

              <tbody>
                {filteredPresidents.map((president) => {
                  const processing =
                    processingId === president.managerId;

                  return (
                    <tr
                      key={president.managerId}
                      className="border-b border-zinc-800/80 last:border-b-0"
                    >
                      <td className="px-6 py-5">
                        <p className="font-black text-white">
                          {president.managerName}
                        </p>
                      </td>

                      <td className="px-6 py-5 font-bold text-zinc-300">
                        {president.clubName}
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${roleClass(
                            president.role
                          )}`}
                        >
                          {roleLabel(president.role)}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <select
                          value={president.role}
                          disabled={processing}
                          onChange={(event) =>
                            changeRole(
                              president,
                              event.target.value as AdminRole
                            )
                          }
                          className="min-w-48 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-black text-white outline-none transition focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="president">PRESIDENTE</option>
                          <option value="admin">ADM</option>
                          <option value="master">ADM MASTER</option>
                        </select>

                        {processing && (
                          <p className="mt-2 text-xs font-bold text-yellow-400">
                            Salvando...
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredPresidents.length === 0 && (
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

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
            <p className="font-black text-green-400">ADM</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Pode abrir, fechar e reabrir o mercado e, futuramente, publicar no Jornal FriendZone.
            </p>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
            <p className="font-black text-purple-400">ADM MASTER</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Tem acesso administrativo completo dentro do FriendZone League FM. Código, GitHub, Vercel e estrutura técnica ficam fora do painel.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
