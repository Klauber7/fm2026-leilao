"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type TransferWindow = {
  id: number;
  window_number: number;
  name: string;
  status: string;
};

type AdminStats = {
  teams: number;
  players: number;
  activeAuctions: number;
  pendingNegotiations: number;
  pendingInstallments: number;
  failedInstallments: number;
};

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [
    currentWindow,
    setCurrentWindow,
  ] =
    useState<TransferWindow | null>(
      null
    );

  const [
    stats,
    setStats,
  ] =
    useState<AdminStats>({
      teams: 0,
      players: 0,
      activeAuctions: 0,
      pendingNegotiations: 0,
      pendingInstallments: 0,
      failedInstallments: 0,
    });

  const loadAdmin =
    useCallback(async () => {
      setLoading(true);

      const {
        data: { user },
        error: authError,
      } =
        await supabase.auth.getUser();

      if (
        authError ||
        !user
      ) {
        router.replace(
          "/login"
        );
        return;
      }

      const {
        data: hasAdminAccess,
        error: adminError,
      } =
        await supabase.rpc(
          "is_site_master"
        );

      if (
        adminError ||
        hasAdminAccess !== true
      ) {
        console.error(
          "Erro ao verificar acesso administrativo:",
          adminError,
          hasAdminAccess
        );

        router.replace(
          "/dashboard"
        );

        return;
      }

      setIsAdmin(true);

      const [
        teamsResult,
        playersResult,
        auctionsResult,
        negotiationsResult,
        pendingInstallmentsResult,
        failedInstallmentsResult,
        windowResult,
      ] =
        await Promise.all([
          supabase
            .from("teams")
            .select(
              "id",
              {
                count:
                  "exact",
                head:
                  true,
              }
            ),

          supabase
            .from(
              "players"
            )
            .select(
              "id",
              {
                count:
                  "exact",
                head:
                  true,
              }
            ),

          supabase
            .from(
              "auctions"
            )
            .select(
              "id",
              {
                count:
                  "exact",
                head:
                  true,
              }
            )
            .eq(
              "status",
              "active"
            ),

          supabase
            .from(
              "negotiations"
            )
            .select(
              "id",
              {
                count:
                  "exact",
                head:
                  true,
              }
            )
            .eq(
              "status",
              "pending"
            ),

          supabase
            .from(
              "negotiation_installments"
            )
            .select(
              "id",
              {
                count:
                  "exact",
                head:
                  true,
              }
            )
            .eq(
              "status",
              "pending"
            ),

          supabase
            .from(
              "negotiation_installments"
            )
            .select(
              "id",
              {
                count:
                  "exact",
                head:
                  true,
              }
            )
            .eq(
              "status",
              "failed"
            ),

          supabase
            .from(
              "transfer_windows"
            )
            .select(`
              id,
              window_number,
              name,
              status
            `)
            .eq(
              "status",
              "open"
            )
            .order(
              "window_number",
              {
                ascending:
                  false,
              }
            )
            .limit(1)
            .maybeSingle(),
        ]);

      setStats({
        teams:
          teamsResult.count ||
          0,

        players:
          playersResult.count ||
          0,

        activeAuctions:
          auctionsResult.count ||
          0,

        pendingNegotiations:
          negotiationsResult.count ||
          0,

        pendingInstallments:
          pendingInstallmentsResult.count ||
          0,

        failedInstallments:
          failedInstallmentsResult.count ||
          0,
      });

      if (
        windowResult.error
      ) {
        console.error(
          windowResult.error
        );

        setCurrentWindow(
          null
        );
      } else {
        setCurrentWindow(
          windowResult.data
            ? (windowResult.data as TransferWindow)
            : null
        );
      }

      setLoading(false);
    }, [router]);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const channel =
      supabase
        .channel(
          "admin-dashboard"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "transfer_windows",
          },
          () => {
            loadAdmin();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "negotiations",
          },
          () => {
            loadAdmin();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "negotiation_installments",
          },
          () => {
            loadAdmin();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "auctions",
          },
          () => {
            loadAdmin();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "teams",
          },
          () => {
            loadAdmin();
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    isAdmin,
    loadAdmin,
  ]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <p className="font-bold text-zinc-400">
          Carregando administração...
        </p>
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const marketOpen =
    Boolean(
      currentWindow
    );

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">

        <header>
          <p className="font-bold uppercase tracking-widest text-red-400">
            FriendZone League FM
          </p>

          <h1 className="mt-2 text-5xl font-black md:text-6xl">
            Administração
          </h1>

          <p className="mt-3 max-w-3xl text-lg text-zinc-400">
            Central de controle da liga. Gerencie clubes,
            usuários, mercado, transferências, finanças,
            leilões e registros oficiais.
          </p>
        </header>

        <section
          className={`mt-10 rounded-2xl border p-6 ${
            marketOpen
              ? "border-green-500/30 bg-green-500/10"
              : "border-red-500/30 bg-red-500/10"
          }`}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p
                className={`text-sm font-black uppercase tracking-widest ${
                  marketOpen
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {marketOpen
                  ? "🟢 Mercado aberto"
                  : "🔒 Mercado fechado"}
              </p>

              <h2 className="mt-2 text-3xl font-black">
                {marketOpen
                  ? `Janela ${currentWindow?.window_number}`
                  : "Nenhuma janela aberta"}
              </h2>

              <p className="mt-2 text-zinc-400">
                {marketOpen
                  ? "Negociações e leilões estão liberados."
                  : "Negociações e novos lances estão bloqueados."}
              </p>
            </div>

            <Link
              href="/admin/finance/windows"
              className="rounded-xl bg-zinc-950 px-6 py-4 text-center font-black transition hover:bg-zinc-900"
            >
              GERENCIAR JANELAS
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Clubes"
            value={stats.teams}
          />

          <StatCard
            label="Jogadores"
            value={stats.players}
          />

          <StatCard
            label="Leilões ativos"
            value={stats.activeAuctions}
            valueClass="text-green-400"
          />

          <StatCard
            label="Propostas"
            value={stats.pendingNegotiations}
            valueClass="text-blue-400"
          />

          <StatCard
            label="Parcelas"
            value={stats.pendingInstallments}
            valueClass="text-yellow-400"
          />

          <StatCard
            label="Falhas"
            value={stats.failedInstallments}
            valueClass={
              stats.failedInstallments > 0
                ? "text-red-400"
                : "text-zinc-300"
            }
          />
        </section>

        <section className="mt-12">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-zinc-500">
              Administração
            </p>

            <h2 className="mt-2 text-3xl font-black">
              Central de Controle
            </h2>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">

            <AdminCard
              href="/admin/teams"
              eyebrow="Liga"
              title="Clubes"
              icon="🏟️"
              description="Veja todos os clubes, presidentes, saldos e jogadores. Corrija orçamento e libere uma equipe quando necessário."
              action="GERENCIAR CLUBES →"
              color="green"
            />

            <AdminCard
              href="/admin/rivalries"
              eyebrow="Liga"
              title="Rivalidades"
              icon="⚔️"
              description="Veja os 3 rivais definidos por cada clube e acompanhe quais equipes ainda não concluíram suas escolhas."
              action="VER RIVALIDADES →"
              color="red"
            />

            <AdminCard
              href="/admin/users"
              eyebrow="Acessos"
              title="Aprovação de Usuários"
              icon="👤"
              description="Aprove, recuse ou reabra o acesso dos presidentes antes da entrada na liga."
              action="GERENCIAR USUÁRIOS →"
              color="red"
            />

            <AdminCard
              href="/admin/administrators"
              eyebrow="Permissões"
              title="Administradores"
              icon="👑"
              description="Escolha entre os presidentes quem será Presidente, ADM ou ADM MASTER."
              action="GERENCIAR ADMINISTRADORES →"
              color="purple"
            />

            <AdminCard
              href="/admin/transfers"
              eyebrow="Auditoria"
              title="Transferências"
              icon="🔄"
              description="Veja propostas, contrapropostas, trocas, pagamentos e transferências concluídas."
              action="ABRIR AUDITORIA →"
              color="blue"
              badge={
                stats.pendingNegotiations > 0
                  ? `${stats.pendingNegotiations} pendente(s)`
                  : undefined
              }
            />

            <AdminCard
              href="/admin/finance"
              eyebrow="Financeiro"
              title="Finanças"
              icon="💰"
              description="Acompanhe saldos e faça ajustes financeiros nos clubes."
              action="GERENCIAR FINANÇAS →"
              color="green"
            />

            <AdminCard
              href="/admin/finance/windows"
              eyebrow="Mercado"
              title="Janelas"
              icon="🪟"
              description="Abra e feche janelas de transferências e controle o funcionamento do mercado."
              action="CONTROLAR JANELAS →"
              color="yellow"
            />

            <AdminCard
              href="/transfers/installments"
              eyebrow="Pagamentos"
              title="Parcelas"
              icon="📆"
              description="Acompanhe parcelas pendentes, pagas e pagamentos com falha."
              action="VER PARCELAS →"
              color="cyan"
              badge={
                stats.pendingInstallments > 0 ||
                stats.failedInstallments > 0
                  ? `${stats.pendingInstallments} pendente(s) • ${stats.failedInstallments} falha(s)`
                  : undefined
              }
            />

            <AdminCard
              href="/admin/auctions"
              eyebrow="Jogadores"
              title="Leilões"
              icon="🔨"
              description="Crie e administre os leilões de jogadores da FriendZone League."
              action="GERENCIAR LEILÕES →"
              color="purple"
            />

            <AdminCard
              href="/admin/draft"
              eyebrow="Liga"
              title="Draft"
              icon="🎯"
              description="Controle rodadas, escolhas e administração do draft."
              action="ABRIR DRAFT →"
              color="orange"
            />

            <AdminCard
              href="/bid"
              eyebrow="Registro oficial"
              title="BID"
              icon="📢"
              description="Consulte o boletim público com jogador, clube de origem, destino e valor de cada transferência."
              action="ABRIR BID →"
              color="zinc"
            />

          </div>
        </section>

        <section className="mt-14">
          <p className="text-sm font-black uppercase tracking-widest text-zinc-500">
            Acessos rápidos
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickLink
              href="/dashboard"
              text="← Dashboard"
            />

            <QuickLink
              href="/players"
              text="Jogadores"
            />

            <QuickLink
              href="/auctions"
              text="Leilões públicos"
            />

            <QuickLink
              href="/history"
              text="Histórico"
            />
          </div>
        </section>

      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
        {label}
      </p>

      <p
        className={`mt-2 text-3xl font-black ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}

type AdminColor =
  | "green"
  | "red"
  | "blue"
  | "yellow"
  | "cyan"
  | "purple"
  | "orange"
  | "zinc";

const cardColors: Record<
  AdminColor,
  {
    card: string;
    eyebrow: string;
    action: string;
    badge: string;
  }
> = {
  green: {
    card:
      "border-green-500/30 bg-green-500/5 hover:border-green-400 hover:bg-green-500/10",
    eyebrow:
      "text-green-400",
    action:
      "text-green-400 group-hover:text-green-300",
    badge:
      "bg-green-500/15 text-green-400",
  },
  red: {
    card:
      "border-red-500/30 bg-red-500/5 hover:border-red-400 hover:bg-red-500/10",
    eyebrow:
      "text-red-400",
    action:
      "text-red-400 group-hover:text-red-300",
    badge:
      "bg-red-500/15 text-red-400",
  },
  blue: {
    card:
      "border-blue-500/30 bg-blue-500/5 hover:border-blue-400 hover:bg-blue-500/10",
    eyebrow:
      "text-blue-400",
    action:
      "text-blue-400 group-hover:text-blue-300",
    badge:
      "bg-blue-500/15 text-blue-400",
  },
  yellow: {
    card:
      "border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-400 hover:bg-yellow-500/10",
    eyebrow:
      "text-yellow-400",
    action:
      "text-yellow-400 group-hover:text-yellow-300",
    badge:
      "bg-yellow-500/15 text-yellow-400",
  },
  cyan: {
    card:
      "border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-400 hover:bg-cyan-500/10",
    eyebrow:
      "text-cyan-400",
    action:
      "text-cyan-400 group-hover:text-cyan-300",
    badge:
      "bg-cyan-500/15 text-cyan-400",
  },
  purple: {
    card:
      "border-purple-500/30 bg-purple-500/5 hover:border-purple-400 hover:bg-purple-500/10",
    eyebrow:
      "text-purple-400",
    action:
      "text-purple-400 group-hover:text-purple-300",
    badge:
      "bg-purple-500/15 text-purple-400",
  },
  orange: {
    card:
      "border-orange-500/30 bg-orange-500/5 hover:border-orange-400 hover:bg-orange-500/10",
    eyebrow:
      "text-orange-400",
    action:
      "text-orange-400 group-hover:text-orange-300",
    badge:
      "bg-orange-500/15 text-orange-400",
  },
  zinc: {
    card:
      "border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800/80",
    eyebrow:
      "text-zinc-400",
    action:
      "text-zinc-300 group-hover:text-white",
    badge:
      "bg-zinc-800 text-zinc-300",
  },
};

function AdminCard({
  href,
  eyebrow,
  title,
  icon,
  description,
  action,
  color,
  badge,
}: {
  href: string;
  eyebrow: string;
  title: string;
  icon: string;
  description: string;
  action: string;
  color: AdminColor;
  badge?: string;
}) {
  const colors =
    cardColors[color];

  return (
    <Link
      href={href}
      className={`group rounded-2xl border p-7 transition hover:-translate-y-1 ${colors.card}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className={`text-sm font-black uppercase tracking-widest ${colors.eyebrow}`}
          >
            {eyebrow}
          </p>

          <h3 className="mt-2 text-2xl font-black">
            {title}
          </h3>
        </div>

        <span className="text-3xl">
          {icon}
        </span>
      </div>

      <p className="mt-4 leading-7 text-zinc-400">
        {description}
      </p>

      {badge && (
        <div
          className={`mt-5 inline-flex rounded-full px-3 py-2 text-sm font-black ${colors.badge}`}
        >
          {badge}
        </div>
      )}

      <p
        className={`mt-6 font-black ${colors.action}`}
      >
        {action}
      </p>
    </Link>
  );
}

function QuickLink({
  href,
  text,
}: {
  href: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
    >
      {text}
    </Link>
  );
}
