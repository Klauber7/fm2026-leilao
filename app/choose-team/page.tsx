"use client";

import {
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Team = {
  id: number;
  name: string;
  budget: number;
  manager_name: string | null;
  manager_id: string | null;
};

export default function ChooseTeamPage() {
  const router = useRouter();

  const [
    userId,
    setUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    managerName,
    setManagerName,
  ] =
    useState("");

  const [
    teamName,
    setTeamName,
  ] =
    useState("");

  const [
    myTeam,
    setMyTeam,
  ] =
    useState<Team | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    loadingPage,
    setLoadingPage,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  /*
    CARREGA USUÁRIO E
    VERIFICA SE ELE JÁ
    POSSUI UMA EQUIPE
  */

  async function loadData() {
    setLoadingPage(true);
    setError("");

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      console.error(
        "Erro ao verificar usuário:",
        userError
      );

      router.replace(
        "/login"
      );

      return;
    }

    const name =
      user.user_metadata
        ?.manager_name ||
      user.email ||
      "Manager";

    setUserId(
      user.id
    );

    setManagerName(
      name
    );

    /*
      CONFIRMA APROVAÇÃO
    */

    const {
      data: adminData,
    } =
      await supabase
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (!adminData) {
      const {
        data: approvalData,
        error:
          approvalError,
      } =
        await supabase
          .from(
            "user_approvals"
          )
          .select("status")
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();

      if (
        approvalError
      ) {
        console.error(
          "Erro ao verificar aprovação:",
          approvalError
        );

        setError(
          "Não foi possível verificar a aprovação da conta."
        );

        setLoadingPage(
          false
        );

        return;
      }

      if (
        approvalData?.status !==
        "approved"
      ) {
        router.replace(
          "/dashboard"
        );

        return;
      }
    }

    /*
      VERIFICA SE JÁ
      POSSUI EQUIPE
    */

    const {
      data: teamData,
      error: teamError,
    } =
      await supabase
        .from("teams")
        .select(`
          id,
          name,
          budget,
          manager_name,
          manager_id
        `)
        .eq(
          "manager_id",
          user.id
        )
        .maybeSingle();

    if (teamError) {
      console.error(
        "Erro ao verificar equipe:",
        teamError
      );

      setError(
        "Não foi possível verificar sua equipe."
      );

      setLoadingPage(
        false
      );

      return;
    }

    if (teamData) {
      setMyTeam(
        teamData as Team
      );

      router.replace(
        "/dashboard"
      );

      return;
    }

    setMyTeam(null);

    setLoadingPage(
      false
    );
  }

  useEffect(() => {
    loadData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
    CRIAR EQUIPE
  */

  async function createTeam() {
    if (!userId) {
      router.replace(
        "/login"
      );

      return;
    }

    if (myTeam) {
      alert(
        "Você já possui uma equipe."
      );

      router.replace(
        "/dashboard"
      );

      return;
    }

    const cleanTeamName =
      teamName
        .trim()
        .replace(
          /\s+/g,
          " "
        );

    if (!cleanTeamName) {
      setError(
        "Digite o nome da sua equipe."
      );

      return;
    }

    if (
      cleanTeamName.length <
      3
    ) {
      setError(
        "O nome da equipe precisa ter pelo menos 3 caracteres."
      );

      return;
    }

    if (
      cleanTeamName.length >
      40
    ) {
      setError(
        "O nome da equipe pode ter no máximo 40 caracteres."
      );

      return;
    }

    setLoading(true);
    setError("");

    /*
      RPC SEGURA NO SUPABASE.

      ELA:
      - impede 2 equipes por usuário
      - impede nome duplicado
      - cria a equipe
      - vincula o presidente
      - aplica R$ 400M de orçamento inicial
    */

    const {
      data,
      error:
        createError,
    } =
      await supabase.rpc(
        "create_manager_team",
        {
          p_team_name:
            cleanTeamName,
          p_manager_name:
            managerName,
        }
      );

    if (createError) {
      console.error(
        "Erro ao criar equipe:",
        createError
      );

      const message =
        String(
          createError.message ||
            ""
        );

      if (
        message.includes(
          "USER_ALREADY_HAS_TEAM"
        )
      ) {
        alert(
          "Você já possui uma equipe."
        );

        router.replace(
          "/dashboard"
        );

        setLoading(false);

        return;
      }

      if (
        message.includes(
          "TEAM_NAME_ALREADY_EXISTS"
        )
      ) {
        setError(
          "Já existe uma equipe com esse nome. Escolha outro nome."
        );

        setLoading(false);

        return;
      }

      if (
        message.includes(
          "TEAM_NAME_TOO_SHORT"
        )
      ) {
        setError(
          "O nome da equipe precisa ter pelo menos 3 caracteres."
        );

        setLoading(false);

        return;
      }

      if (
        message.includes(
          "TEAM_NAME_TOO_LONG"
        )
      ) {
        setError(
          "O nome da equipe pode ter no máximo 40 caracteres."
        );

        setLoading(false);

        return;
      }

      if (
        message.includes(
          "INVALID_TEAM_NAME"
        )
      ) {
        setError(
          "Digite um nome válido para sua equipe."
        );

        setLoading(false);

        return;
      }

      if (
        message.includes(
          "USER_NOT_APPROVED"
        )
      ) {
        setError(
          "Sua conta ainda não foi aprovada pela administração."
        );

        setLoading(false);

        return;
      }

      if (
        message.includes(
          "NOT_AUTHENTICATED"
        )
      ) {
        router.replace(
          "/login"
        );

        setLoading(false);

        return;
      }

      setError(
        "Não foi possível criar sua equipe."
      );

      setLoading(false);

      return;
    }

    console.log(
      "Equipe criada:",
      data
    );

    alert(
      `${cleanTeamName} criado com sucesso!`
    );

    router.replace(
      "/dashboard"
    );

    router.refresh();
  }

  if (loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">

        <div className="text-center">

          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-800 border-t-green-500" />

          <p className="mt-4 font-semibold text-slate-400">
            Preparando sua equipe...
          </p>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">

      <div className="mx-auto max-w-5xl">

        {/* HEADER */}

        <div className="mb-10">

          <p className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
            FriendZone League FM
          </p>

          <h1 className="mt-2 text-4xl font-black md:text-5xl">
            Criar Minha Equipe
          </h1>

          <p className="mt-3 text-slate-400">
            Presidente:{" "}
            <span className="font-bold text-green-400">
              {managerName}
            </span>
          </p>

        </div>

        {/* EXPLICAÇÃO */}

        <div className="mb-8 rounded-2xl border border-green-500/20 bg-green-500/5 p-6">

          <h2 className="text-xl font-black text-green-400">
            Crie seu clube
          </h2>

          <p className="mt-2 leading-7 text-slate-300">
            Escolha o nome da sua equipe. Depois de criada, ela ficará vinculada à sua conta e você será direcionado para o Dashboard.
          </p>

          <p className="mt-3 text-sm font-bold text-slate-400">
            Orçamento inicial:{" "}
            <span className="text-white">
              R$ 400.000.000
            </span>
          </p>

        </div>

        {/* FORM */}

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8">

          <label className="block text-sm font-black text-slate-300">
            Nome da sua equipe
          </label>

          <input
            type="text"
            value={teamName}
            maxLength={40}
            autoFocus
            disabled={loading}
            onChange={(
              event
            ) => {
              setTeamName(
                event.target.value
              );

              if (error) {
                setError("");
              }
            }}
            onKeyDown={(
              event
            ) => {
              if (
                event.key ===
                  "Enter" &&
                !loading &&
                teamName
                  .trim()
                  .length >=
                  3
              ) {
                createTeam();
              }
            }}
            placeholder="Ex: Boca Raton FC"
            className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-4 text-lg font-bold text-white outline-none transition focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-50"
          />

          <div className="mt-2 flex items-center justify-between gap-3">

            <p className="text-sm text-slate-500">
              Mínimo 3 caracteres
            </p>

            <p
              className={`text-sm font-bold ${
                teamName.length >
                35
                  ? "text-yellow-400"
                  : "text-slate-500"
              }`}
            >
              {teamName.length}/40
            </p>

          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-bold text-red-300">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={
              createTeam
            }
            disabled={
              loading ||
              teamName
                .trim()
                .length <
                3
            }
            className="mt-6 w-full rounded-xl bg-green-500 px-6 py-4 text-lg font-black text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {loading
              ? "Criando equipe..."
              : "Criar minha equipe"}
          </button>

        </div>

        {/* REGRAS */}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">

            <p className="text-2xl">
              👤
            </p>

            <p className="mt-3 font-black">
              1 presidente
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Cada conta pode possuir apenas uma equipe.
            </p>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">

            <p className="text-2xl">
              🏟️
            </p>

            <p className="mt-3 font-black">
              Nome exclusivo
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Duas equipes não podem usar o mesmo nome.
            </p>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">

            <p className="text-2xl">
              💰
            </p>

            <p className="mt-3 font-black">
              R$ 400M
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Orçamento inicial aplicado automaticamente.
            </p>

          </div>

        </div>

      </div>

    </main>
  );
}
