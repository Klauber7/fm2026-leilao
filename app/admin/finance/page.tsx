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


type Team = {
  id: number;
  name: string;
  budget: number | null;
  manager_name: string | null;
};


type FinancialTransaction = {
  id: number;
  team_id: number;
  team_name: string;
  transaction_type:
    | "credit"
    | "debit"
    | "adjustment";
  amount: number;
  reason: string;
  balance_before: number;
  balance_after: number;
  created_at: string;
};


type InstallmentSummary = {
  payer_team_id: number;
  receiver_team_id: number;
  amount: number;
  status: string;
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


function transactionLabel(
  type:
    | "credit"
    | "debit"
    | "adjustment"
) {
  if (type === "credit") {
    return "Crédito";
  }

  if (type === "debit") {
    return "Multa / Débito";
  }

  return "Ajuste";
}


export default function AdminFinancePage() {
  const router = useRouter();


  const [isAdmin, setIsAdmin] =
    useState(false);


  const [loadingPage, setLoadingPage] =
    useState(true);


  const [teams, setTeams] =
    useState<Team[]>([]);


  const [
    transactions,
    setTransactions,
  ] =
    useState<
      FinancialTransaction[]
    >([]);


  const [
    installments,
    setInstallments,
  ] =
    useState<
      InstallmentSummary[]
    >([]);


  const [
    selectedTeamId,
    setSelectedTeamId,
  ] =
    useState("");


  const [
    transactionType,
    setTransactionType,
  ] =
    useState<
      "credit" |
      "debit" |
      "adjustment"
    >("credit");


  const [amount, setAmount] =
    useState("");


  const [reason, setReason] =
    useState("");


  const [saving, setSaving] =
    useState(false);


  const selectedTeam =
    useMemo(() => {
      const id =
        Number(selectedTeamId);

      if (!id) {
        return null;
      }

      return (
        teams.find(
          (team) =>
            team.id === id
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


      if (
        userError ||
        !user
      ) {
        router.replace(
          "/login"
        );

        return;
      }


      const {
        data: adminData,
        error: adminError,
      } =
        await supabase
          .from("admin_users")
          .select("user_id")
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();


      if (adminError) {
        console.error(
          adminError
        );

        alert(
          "Erro ao verificar acesso administrativo."
        );

        router.replace(
          "/dashboard"
        );

        return;
      }


      if (!adminData) {
        alert(
          "Você não possui acesso administrativo."
        );

        router.replace(
          "/dashboard"
        );

        return;
      }


      setIsAdmin(true);


      const [
        teamsResponse,
        transactionsResponse,
        installmentsResponse,
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
            .order(
              "name",
              {
                ascending:
                  true,
              }
            ),

          supabase
            .from(
              "financial_transactions"
            )
            .select(
              `
              id,
              team_id,
              team_name,
              transaction_type,
              amount,
              reason,
              balance_before,
              balance_after,
              created_at
              `
            )
            .order(
              "created_at",
              {
                ascending:
                  false,
              }
            )
            .limit(100),

          supabase
            .from(
              "negotiation_installments"
            )
            .select(
              `
              payer_team_id,
              receiver_team_id,
              amount,
              status
              `
            ),

        ]);


      if (
        teamsResponse.error
      ) {
        console.error(
          teamsResponse.error
        );

        alert(
          "Erro ao carregar clubes."
        );

        setLoadingPage(
          false
        );

        return;
      }


      if (
        transactionsResponse.error
      ) {
        console.error(
          transactionsResponse.error
        );

        alert(
          "Erro ao carregar histórico financeiro."
        );

        setLoadingPage(
          false
        );

        return;
      }


      setTeams(
        (teamsResponse.data ||
          []) as Team[]
      );


      setTransactions(
        (transactionsResponse.data ||
          []) as FinancialTransaction[]
      );

      if (
        installmentsResponse.error
      ) {
        console.error(
          installmentsResponse.error
        );
      }

      setInstallments(
        (installmentsResponse.data ||
          []) as InstallmentSummary[]
      );


      setLoadingPage(false);
    }, [router]);


  useEffect(() => {
    loadPage();
  }, [loadPage]);


  const totalLeagueBudget =
    useMemo(
      () =>
        teams.reduce(
          (
            total,
            team
          ) =>
            total +
            Number(
              team.budget ||
                0
            ),
          0
        ),
      [teams]
    );


  const pendingDebt =
    useMemo(
      () =>
        installments
          .filter(
            (item) =>
              item.status ===
                "pending" ||
              item.status ===
                "failed"
          )
          .reduce(
            (
              total,
              item
            ) =>
              total +
              Number(
                item.amount ||
                  0
              ),
            0
          ),
      [installments]
    );


  const selectedTeamPendingDebt =
    useMemo(() => {
      if (
        !selectedTeam
      ) {
        return 0;
      }

      return installments
        .filter(
          (item) =>
            item.payer_team_id ===
              selectedTeam.id &&
            (
              item.status ===
                "pending" ||
              item.status ===
                "failed"
            )
        )
        .reduce(
          (
            total,
            item
          ) =>
            total +
            Number(
              item.amount ||
                0
            ),
          0
        );
    }, [
      installments,
      selectedTeam,
    ]);


  const selectedTeamReceivable =
    useMemo(() => {
      if (
        !selectedTeam
      ) {
        return 0;
      }

      return installments
        .filter(
          (item) =>
            item.receiver_team_id ===
              selectedTeam.id &&
            (
              item.status ===
                "pending" ||
              item.status ===
                "failed"
            )
        )
        .reduce(
          (
            total,
            item
          ) =>
            total +
            Number(
              item.amount ||
                0
            ),
          0
        );
    }, [
      installments,
      selectedTeam,
    ]);


  async function submitTransaction() {
    if (!selectedTeam) {
      alert(
        "Escolha um clube."
      );

      return;
    }


    const numericAmount =
      Number(amount);


    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      alert(
        "Digite um valor válido."
      );

      return;
    }


    const cleanReason =
      reason.trim();


    if (!cleanReason) {
      alert(
        "Informe o motivo."
      );

      return;
    }


    const actionText =
      transactionType ===
      "debit"
        ? "retirar"
        : "adicionar";


    const confirmed =
      window.confirm(
        `${actionText} ${money(
          numericAmount
        )} ${
          transactionType ===
          "debit"
            ? "do"
            : "ao"
        } ${selectedTeam.name}?\n\nMotivo: ${cleanReason}`
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
        "admin_adjust_team_budget",
        {
          p_team_id:
            selectedTeam.id,

          p_transaction_type:
            transactionType,

          p_amount:
            numericAmount,

          p_reason:
            cleanReason,
        }
      );


    setSaving(false);


    if (error) {
      console.error(
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
          "INSUFFICIENT_BUDGET"
        )
      ) {
        alert(
          "O clube não possui saldo suficiente para essa multa."
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
          "REASON_REQUIRED"
        )
      ) {
        alert(
          "Informe o motivo."
        );

        return;
      }


      alert(
        error.message
      );

      return;
    }


    console.log(
      "Resultado:",
      data
    );


    alert(
      "Operação financeira registrada com sucesso!"
    );


    setAmount("");
    setReason("");


    await loadPage();
  }


  if (loadingPage) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="font-bold text-zinc-400">
          Carregando administração financeira...
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

        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

          <div>
            <p className="font-bold uppercase tracking-widest text-green-400">
              Área administrativa
            </p>

            <h1 className="mt-2 text-5xl font-black">
              💰 Finanças dos Clubes
            </h1>

            <p className="mt-3 text-zinc-400">
              Adicione créditos, aplique multas, registre ajustes e acompanhe compromissos financeiros.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-center font-black transition hover:bg-zinc-800"
          >
            ← Administração
          </Link>

        </header>


        <section className="mt-8 grid gap-4 md:grid-cols-3">

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Dinheiro na liga
            </p>

            <p className="mt-2 text-3xl font-black text-blue-400">
              {money(totalLeagueBudget)}
            </p>
          </div>

          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Parcelas comprometidas
            </p>

            <p className="mt-2 text-3xl font-black text-yellow-400">
              {money(pendingDebt)}
            </p>
          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Clubes
            </p>

            <p className="mt-2 text-3xl font-black text-green-400">
              {teams.length}
            </p>
          </div>

        </section>


        {/* CLUBE */}

        <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

          <h2 className="text-2xl font-black">
            1. Escolher clube
          </h2>


          <select
            value={
              selectedTeamId
            }
            onChange={(
              event
            ) =>
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


          {selectedTeam && (
            <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-5">

              <p className="text-2xl font-black">
                {
                  selectedTeam.name
                }
              </p>

              <p className="mt-2 text-green-400 font-bold">
                Saldo atual:{" "}
                {money(
                  selectedTeam.budget
                )}
              </p>

              <p className="mt-1 text-zinc-500">
                Presidente:{" "}
                {selectedTeam.manager_name ||
                  "Não definido"}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                    Parcelas a pagar
                  </p>

                  <p className="mt-1 text-xl font-black text-yellow-400">
                    {money(selectedTeamPendingDebt)}
                  </p>
                </div>

                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                    Parcelas a receber
                  </p>

                  <p className="mt-1 text-xl font-black text-green-400">
                    {money(selectedTeamReceivable)}
                  </p>
                </div>
              </div>

            </div>
          )}

        </section>


        {/* TIPO */}

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

          <h2 className="text-2xl font-black">
            2. Tipo da operação
          </h2>


          <div className="mt-5 grid gap-4 md:grid-cols-3">

            <button
              type="button"
              onClick={() =>
                setTransactionType(
                  "credit"
                )
              }
              className={`rounded-xl border p-5 text-left ${
                transactionType ===
                "credit"
                  ? "border-green-500 bg-green-500/10"
                  : "border-zinc-700 bg-zinc-950"
              }`}
            >
              <p className="text-xl font-black text-green-400">
                + Adicionar
              </p>

              <p className="mt-2 text-sm text-zinc-400">
                Premiações, bônus e receitas.
              </p>
            </button>


            <button
              type="button"
              onClick={() =>
                setTransactionType(
                  "debit"
                )
              }
              className={`rounded-xl border p-5 text-left ${
                transactionType ===
                "debit"
                  ? "border-red-500 bg-red-500/10"
                  : "border-zinc-700 bg-zinc-950"
              }`}
            >
              <p className="text-xl font-black text-red-400">
                − Multa
              </p>

              <p className="mt-2 text-sm text-zinc-400">
                Retira dinheiro do orçamento.
              </p>
            </button>


            <button
              type="button"
              onClick={() =>
                setTransactionType(
                  "adjustment"
                )
              }
              className={`rounded-xl border p-5 text-left ${
                transactionType ===
                "adjustment"
                  ? "border-yellow-500 bg-yellow-500/10"
                  : "border-zinc-700 bg-zinc-950"
              }`}
            >
              <p className="text-xl font-black text-yellow-400">
                Ajuste
              </p>

              <p className="mt-2 text-sm text-zinc-400">
                Correções administrativas.
              </p>
            </button>

          </div>

        </section>


        {/* VALOR */}

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

          <h2 className="text-2xl font-black">
            3. Valor
          </h2>


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
            className="mt-5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-xl font-bold outline-none focus:border-green-500"
          />


          {amount &&
            Number(amount) >
              0 && (
              <p className="mt-3 text-2xl font-black text-green-400">
                {money(
                  Number(
                    amount
                  )
                )}
              </p>
            )}

        </section>


        {/* MOTIVO */}

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

          <h2 className="text-2xl font-black">
            4. Motivo
          </h2>


          <div className="mt-5 grid gap-3 md:grid-cols-2">

            {[
              "Direitos de transmissão",
              "Bônus por vitória",
              "Bônus por empate",
              "Premiação por classificação",
              "Premiação de competição",
              "Patrocínio",
              "Multa disciplinar",
              "Correção de orçamento",
            ].map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() =>
                    setReason(
                      item
                    )
                  }
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-left font-bold transition hover:border-green-500"
                >
                  {item}
                </button>
              )
            )}

          </div>


          <textarea
            value={reason}
            onChange={(
              event
            ) =>
              setReason(
                event.target
                  .value
              )
            }
            placeholder="Digite ou selecione o motivo..."
            rows={4}
            className="mt-5 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 outline-none focus:border-green-500"
          />

        </section>


        {/* CONFIRMAR */}

        <button
          type="button"
          onClick={
            submitTransaction
          }
          disabled={
            saving ||
            !selectedTeam ||
            !amount ||
            !reason.trim()
          }
          className={`mt-6 w-full rounded-xl px-6 py-5 text-xl font-black transition disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 ${
            transactionType ===
            "debit"
              ? "bg-red-600 hover:bg-red-500"
              : "bg-green-600 hover:bg-green-500"
          }`}
        >
          {saving
            ? "Registrando..."
            : transactionType ===
              "debit"
            ? "APLICAR MULTA"
            : "ADICIONAR DINHEIRO"}
        </button>


        <section className="mt-10 grid gap-3 md:grid-cols-3">

          <Link
            href="/admin/teams"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            🏟️ Gerenciar clubes
          </Link>

          <Link
            href="/admin/installments"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            📆 Ver parcelas
          </Link>

          <Link
            href="/admin/finance/windows"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            🪟 Gerenciar janelas
          </Link>

        </section>


        {/* HISTÓRICO */}

        <section className="mt-14">

          <h2 className="text-3xl font-black">
            Histórico financeiro
          </h2>


          <div className="mt-6 space-y-3">

            {transactions.length ===
            0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-500">
                Nenhuma operação registrada.
              </div>
            ) : (
              transactions.map(
                (
                  transaction
                ) => (
                  <div
                    key={
                      transaction.id
                    }
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
                  >

                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                      <div>

                        <p className="font-black">
                          {
                            transaction.team_name
                          }
                        </p>

                        <p className="mt-1 text-sm text-zinc-400">
                          {
                            transaction.reason
                          }
                        </p>

                        <p className="mt-2 text-xs text-zinc-600">
                          {new Date(
                            transaction.created_at
                          ).toLocaleString(
                            "pt-BR"
                          )}
                        </p>

                      </div>


                      <div className="text-left md:text-right">

                        <p
                          className={`text-xl font-black ${
                            transaction.transaction_type ===
                            "debit"
                              ? "text-red-400"
                              : "text-green-400"
                          }`}
                        >
                          {transaction.transaction_type ===
                          "debit"
                            ? "− "
                            : "+ "}

                          {money(
                            transaction.amount
                          )}
                        </p>


                        <p className="mt-1 text-xs text-zinc-500">
                          {transactionLabel(
                            transaction.transaction_type
                          )}
                        </p>


                        <p className="mt-1 text-xs text-zinc-500">
                          {money(
                            transaction.balance_before
                          )}
                          {" → "}
                          {money(
                            transaction.balance_after
                          )}
                        </p>

                      </div>

                    </div>

                  </div>
                )
              )
            )}

          </div>

        </section>

      </div>

    </main>
  );
}