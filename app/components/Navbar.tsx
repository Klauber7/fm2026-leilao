"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import { supabase } from "@/lib/supabase";

type AdminRole =
  | "owner"
  | "master"
  | "admin"
  | null;

type MenuItem = {
  href: string;
  label: string;
  icon: string;
};

const mainMenu: MenuItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "🏠",
  },
  {
    href: "/players",
    label: "Mercado de Jogadores",
    icon: "🌍",
  },
  {
    href: "/coaches",
    label: "Mercado de Treinadores",
    icon: "🧥",
  },
  {
    href: "/bid",
    label: "BID",
    icon: "📢",
  },
  {
    href: "/squad",
    label: "Elenco",
    icon: "⚽",
  },
  {
    href: "/staff",
    label: "Comissão Técnica",
    icon: "👨‍💼",
  },
  {
    href: "/auctions",
    label: "Leilões de Jogadores",
    icon: "🔥",
  },
  {
    href: "/staff-auctions",
    label: "Leilão da Comissão",
    icon: "🔨",
  },
  {
    href: "/transfers",
    label: "Contratações",
    icon: "📄",
  },
  {
    href: "/history",
    label: "Histórico",
    icon: "📊",
  },
  {
    href: "/teams",
    label: "Clubes",
    icon: "🏟️",
  },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [
    adminRole,
    setAdminRole,
  ] =
    useState<AdminRole>(null);

  const [
    mobileOpen,
    setMobileOpen,
  ] =
    useState(false);

  useEffect(() => {
    checkAdminRole();
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow =
      "hidden";

    function handleEscape(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [mobileOpen]);

  async function checkAdminRole() {
    const {
      data: { user },
      error: authError,
    } =
      await supabase.auth.getUser();

    if (
      authError ||
      !user
    ) {
      setAdminRole(null);
      return;
    }

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "get_my_admin_role"
      );

    if (error) {
      console.error(
        "Erro ao verificar nível administrativo:",
        error
      );

      setAdminRole(null);
      return;
    }

    if (
      data === "owner" ||
      data === "master" ||
      data === "admin"
    ) {
      setAdminRole(data);
      return;
    }

    setAdminRole(null);
  }

  async function handleLogout() {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      alert(
        "Erro ao sair da conta."
      );
      return;
    }

    setMobileOpen(false);

    router.push("/login");
    router.refresh();
  }

  const canOpenFullAdmin =
    adminRole === "owner" ||
    adminRole === "master";

  const isLimitedAdmin =
    adminRole === "admin";

  function isActive(
    href: string
  ) {
    if (
      href === "/dashboard"
    ) {
      return (
        pathname ===
        "/dashboard"
      );
    }

    return pathname.startsWith(
      href
    );
  }

  function menuLinkClass(
    href: string
  ) {
    const active =
      isActive(href);

    return [
      "block rounded-xl px-4 py-3 transition",
      active
        ? "bg-zinc-900 text-green-400"
        : "text-zinc-300 hover:bg-zinc-900 hover:text-green-400",
    ].join(" ");
  }

  const navigation = (
    <>
      <nav className="space-y-2 text-sm font-bold">

        {mainMenu.map(
          (item) => (
            <Link
              key={item.href}
              href={item.href}
              className={menuLinkClass(
                item.href
              )}
            >
              <span className="mr-2">
                {item.icon}
              </span>

              {item.label}
            </Link>
          )
        )}

        {canOpenFullAdmin && (
          <>
            <div className="my-3 border-t border-zinc-800" />

            <Link
              href="/admin"
              className={[
                "block rounded-xl border px-4 py-3 transition",
                pathname.startsWith(
                  "/admin"
                )
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:text-red-300",
              ].join(" ")}
            >
              ⚙️ Administração
            </Link>
          </>
        )}

        {isLimitedAdmin && (
          <>
            <div className="my-3 border-t border-zinc-800" />

            <Link
              href="/admin/finance/windows"
              className={[
                "block rounded-xl border px-4 py-3 transition",
                pathname.startsWith(
                  "/admin/finance/windows"
                )
                  ? "border-green-500/30 bg-green-500/10 text-green-300"
                  : "border-green-500/20 bg-green-500/5 text-green-400 hover:bg-green-500/10 hover:text-green-300",
              ].join(" ")}
            >
              🪟 Controle do Mercado
            </Link>
          </>
        )}

      </nav>

      <div className="mt-auto pt-6">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-red-500"
        >
          Sair
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* MOBILE TOP BAR */}
      <header className="fixed inset-x-0 top-0 z-[60] flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 text-white backdrop-blur lg:hidden">

        <Link
          href="/dashboard"
          className="leading-tight"
        >
          <p className="text-base font-black">
            <span className="text-green-400">
              FriendZone
            </span>{" "}
            League FM
          </p>
        </Link>

        <button
          type="button"
          aria-label={
            mobileOpen
              ? "Fechar menu"
              : "Abrir menu"
          }
          aria-expanded={
            mobileOpen
          }
          onClick={() =>
            setMobileOpen(
              (current) =>
                !current
            )
          }
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-xl transition hover:border-zinc-700 hover:bg-zinc-800"
        >
          {mobileOpen
            ? "✕"
            : "☰"}
        </button>

      </header>

      {/* MOBILE OVERLAY */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() =>
            setMobileOpen(false)
          }
          className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* MOBILE DRAWER */}
      <aside
        className={[
          "fixed left-0 top-0 z-[70] h-dvh w-[86%] max-w-[330px] border-r border-zinc-800 bg-zinc-950 text-white transition-transform duration-300 lg:hidden",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-full flex-col overflow-y-auto px-5 pb-5 pt-5">

          <div className="mb-6 flex items-center justify-between gap-4">

            <Link
              href="/dashboard"
              className="block"
            >
              <h1 className="text-xl font-black leading-tight">
                <span className="text-green-400">
                  FriendZone
                </span>

                <br />

                League FM
              </h1>
            </Link>

            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() =>
                setMobileOpen(false)
              }
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-lg"
            >
              ✕
            </button>

          </div>

          {navigation}

        </div>
      </aside>

      {/* DESKTOP SIDEBAR */}
      <aside className="fixed left-0 top-0 z-50 hidden h-screen w-72 border-r border-zinc-800 bg-zinc-950 text-white lg:block">

        <div className="flex h-full flex-col overflow-y-auto p-6">

          <Link
            href="/dashboard"
            className="mb-10 block"
          >
            <h1 className="text-2xl font-black leading-tight">
              <span className="text-green-400">
                FriendZone
              </span>

              <br />

              League FM
            </h1>
          </Link>

          {navigation}

        </div>

      </aside>

      {/* MOBILE SPACER */}
      <div className="h-16 lg:hidden" />
    </>
  );
}
