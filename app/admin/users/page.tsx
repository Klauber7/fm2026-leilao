"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected";

type Approval = {
  user_id: string;
  email: string | null;
  status: ApprovalStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type FilterStatus =
  | "all"
  | "pending"
  | "approved"
  | "rejected";

export default function AdminUsersPage() {
  const router = useRouter();

  const [approvals, setApprovals] =
    useState<Approval[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<FilterStatus>("pending");

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      /*
        AUTH
      */

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      /*
        CONFIRMA PERMISSÃO ADMINISTRATIVA
        OWNER + ADM MASTER
      */

      const {
        data: adminRole,
        error: adminError,
      } = await supabase.rpc(
        "get_my_admin_role"
      );

      if (adminError) {
        console.error(
          "Erro ao verificar nível administrativo:",
          adminError
        );

        setError(
          "Não foi possível verificar sua permissão administrativa."
        );

        return;
      }

      if (
        !["owner", "master"].includes(
          String(adminRole)
        )
      ) {
        router.replace("/dashboard");
        return;
      }

      /*
        CARREGA APROVAÇÕES
      */

      const {
        data,
        error: approvalError,
      } = await supabase
        .from("user_approvals")
        .select(`
          user_id,
          email,
          status,
          created_at,
          reviewed_at,
          reviewed_by
        `)
        .order("created_at", {
          ascending: false,
        });

      if (approvalError) {
        console.error(
          "Erro ao carregar aprovações:",
          approvalError
        );

        setError(
          "Não foi possível carregar os cadastros."
        );

        return;
      }

      setApprovals(
        (data || []) as Approval[]
      );
    } catch (err) {
      console.error(err);

      setError(
        "Ocorreu um erro ao carregar os usuários."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  /*
    REALTIME
  */

  useEffect(() => {
    const channel =
      supabase
        .channel("admin-user-approvals")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_approvals",
          },
          () => {
            loadUsers();
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadUsers]);

  /*
    ALTERAR STATUS
  */

  async function changeStatus(
    approval: Approval,
    status: ApprovalStatus
  ) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError(
        "Sua sessão expirou. Entre novamente."
      );
      return;
    }

    let actionText = "";

    if (status === "approved") {
      actionText = "aprovar";
    }

    if (status === "rejected") {
      actionText = "recusar";
    }

    if (status === "pending") {
      actionText = "reabrir";
    }

    const confirmed =
      window.confirm(
        `Tem certeza que deseja ${actionText} o cadastro de ${
          approval.email ||
          "este usuário"
        }?`
      );

    if (!confirmed) {
      return;
    }

    setProcessingId(
      approval.user_id
    );

    setError("");
    setMessage("");

    const {
      error: updateError,
    } = await supabase
      .from("user_approvals")
      .update({
        status,

        reviewed_at:
          status === "pending"
            ? null
            : new Date().toISOString(),

        reviewed_by:
          status === "pending"
            ? null
            : user.id,
      })
      .eq(
        "user_id",
        approval.user_id
      );

    if (updateError) {
      console.error(
        "Erro ao atualizar cadastro:",
        updateError
      );

      setError(
        "Não foi possível atualizar o cadastro."
      );

      setProcessingId(null);
      return;
    }

    if (
      status === "approved"
    ) {
      setMessage(
        `${
          approval.email ||
          "Usuário"
        } foi aprovado com sucesso.`
      );
    }

    if (
      status === "rejected"
    ) {
      setMessage(
        `${
          approval.email ||
          "Usuário"
        } foi recusado.`
      );
    }

    if (
      status === "pending"
    ) {
      setMessage(
        `${
          approval.email ||
          "Usuário"
        } voltou para análise.`
      );
    }

    await loadUsers();

    setProcessingId(null);
  }

  /*
    FILTROS
  */

  const filtered =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return approvals.filter(
        (approval) => {
          const matchesStatus =
            filter === "all" ||
            approval.status ===
              filter;

          const matchesSearch =
            !term ||
            (
              approval.email ||
              ""
            )
              .toLowerCase()
              .includes(term);

          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      approvals,
      search,
      filter,
    ]);

  /*
    CONTADORES
  */

  const pendingCount =
    useMemo(
      () =>
        approvals.filter(
          (item) =>
            item.status ===
            "pending"
        ).length,
      [approvals]
    );

  const approvedCount =
    useMemo(
      () =>
        approvals.filter(
          (item) =>
            item.status ===
            "approved"
        ).length,
      [approvals]
    );

  const rejectedCount =
    useMemo(
      () =>
        approvals.filter(
          (item) =>
            item.status ===
            "rejected"
        ).length,
      [approvals]
    );

  function formatDate(
    value: string | null
  ) {
    if (!value) {
      return "-";
    }

    return new Date(
      value
    ).toLocaleString(
      "pt-BR"
    );
  }

  /*
    LOADING
  */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-zinc-800 border-t-red-400" />

          <p className="mt-4 font-bold text-zinc-400">
            Carregando usuários...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white md:px-10">

      <div className="mx-auto max-w-7xl">

        {/* VOLTAR */}

        <Link
          href="/admin"
          className="font-bold text-zinc-500 transition hover:text-white"
        >
          ← Administração
        </Link>

        {/* HEADER */}

        <header className="mt-8">

          <p className="font-black uppercase tracking-widest text-red-400">
            Administração
          </p>

          <h1 className="mt-2 text-4xl font-black md:text-6xl">
            Aprovação de Usuários
          </h1>

          <p className="mt-3 max-w-3xl text-zinc-400">
            Aprove ou recuse novos cadastros antes
            que o usuário possa acessar a
            FriendZone League FM.
          </p>

        </header>

        {/* RESUMO */}

        <section className="mt-10 grid gap-4 sm:grid-cols-3">

          <button
            type="button"
            onClick={() =>
              setFilter("pending")
            }
            className={`rounded-2xl border p-6 text-left transition ${
              filter === "pending"
                ? "border-yellow-400 bg-yellow-500/10"
                : "border-yellow-500/20 bg-yellow-500/5 hover:border-yellow-500/40"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Pendentes
            </p>

            <p className="mt-3 text-4xl font-black text-yellow-400">
              {pendingCount}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setFilter(
                "approved"
              )
            }
            className={`rounded-2xl border p-6 text-left transition ${
              filter === "approved"
                ? "border-green-400 bg-green-500/10"
                : "border-green-500/20 bg-green-500/5 hover:border-green-500/40"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Aprovados
            </p>

            <p className="mt-3 text-4xl font-black text-green-400">
              {approvedCount}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setFilter(
                "rejected"
              )
            }
            className={`rounded-2xl border p-6 text-left transition ${
              filter === "rejected"
                ? "border-red-400 bg-red-500/10"
                : "border-red-500/20 bg-red-500/5 hover:border-red-500/40"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Recusados
            </p>

            <p className="mt-3 text-4xl font-black text-red-400">
              {rejectedCount}
            </p>
          </button>

        </section>

        {/* FILTROS */}

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

          <div className="grid gap-4 md:grid-cols-[1fr_260px]">

            <div>
              <label className="mb-2 block text-sm font-black text-zinc-300">
                Buscar
              </label>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Buscar e-mail..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-green-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-zinc-300">
                Status
              </label>

              <select
                value={filter}
                onChange={(event) =>
                  setFilter(
                    event.target
                      .value as FilterStatus
                  )
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-green-500"
              >
                <option value="all">
                  Todos
                </option>

                <option value="pending">
                  Pendentes
                </option>

                <option value="approved">
                  Aprovados
                </option>

                <option value="rejected">
                  Recusados
                </option>
              </select>
            </div>

          </div>

        </section>

        {/* MENSAGENS */}

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-bold text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 font-bold text-green-300">
            {message}
          </div>
        )}

        {/* LISTA */}

        <section className="mt-8">

          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

            <h2 className="text-2xl font-black">
              Cadastros
            </h2>

            <span className="text-sm font-bold text-zinc-500">
              {filtered.length} usuário(s)
            </span>

          </div>

          {filtered.length ===
          0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">

              <p className="text-4xl">
                👤
              </p>

              <h3 className="mt-4 text-xl font-black">
                Nenhum cadastro encontrado
              </h3>

              <p className="mt-2 text-zinc-500">
                Novos usuários aparecerão aqui
                para aprovação.
              </p>

            </div>
          ) : (
            <div className="space-y-4">

              {filtered.map(
                (approval) => {
                  const processing =
                    processingId ===
                    approval.user_id;

                  return (
                    <article
                      key={
                        approval.user_id
                      }
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
                    >

                      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

                        <div>

                          <div className="flex flex-wrap items-center gap-3">

                            <h3 className="text-xl font-black">
                              {approval.email ||
                                "E-mail não informado"}
                            </h3>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black ${
                                approval.status ===
                                "approved"
                                  ? "bg-green-500/15 text-green-400"
                                  : approval.status ===
                                    "rejected"
                                  ? "bg-red-500/15 text-red-400"
                                  : "bg-yellow-500/15 text-yellow-400"
                              }`}
                            >
                              {approval.status ===
                              "approved"
                                ? "APROVADO"
                                : approval.status ===
                                  "rejected"
                                ? "RECUSADO"
                                : "PENDENTE"}
                            </span>

                          </div>

                          <p className="mt-3 text-sm text-zinc-500">
                            Cadastro:{" "}
                            {formatDate(
                              approval.created_at
                            )}
                          </p>

                          {approval.reviewed_at && (
                            <p className="mt-1 text-sm text-zinc-600">
                              Revisado:{" "}
                              {formatDate(
                                approval.reviewed_at
                              )}
                            </p>
                          )}

                        </div>

                        <div className="flex flex-wrap gap-3">

                          {approval.status !==
                            "approved" && (
                            <button
                              type="button"
                              disabled={
                                processing
                              }
                              onClick={() =>
                                changeStatus(
                                  approval,
                                  "approved"
                                )
                              }
                              className="rounded-xl bg-green-500 px-5 py-3 font-black text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {processing
                                ? "Processando..."
                                : "✓ Aprovar"}
                            </button>
                          )}

                          {approval.status !==
                            "rejected" && (
                            <button
                              type="button"
                              disabled={
                                processing
                              }
                              onClick={() =>
                                changeStatus(
                                  approval,
                                  "rejected"
                                )
                              }
                              className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-3 font-black text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              ✕ Recusar
                            </button>
                          )}

                          {approval.status !==
                            "pending" && (
                            <button
                              type="button"
                              disabled={
                                processing
                              }
                              onClick={() =>
                                changeStatus(
                                  approval,
                                  "pending"
                                )
                              }
                              className="rounded-xl border border-zinc-700 bg-zinc-950 px-5 py-3 font-black text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              ↺ Reabrir
                            </button>
                          )}

                        </div>

                      </div>

                    </article>
                  );
                }
              )}

            </div>
          )}

        </section>

      </div>

    </main>
  );
}
