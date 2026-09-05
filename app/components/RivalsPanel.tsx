"use client";

import {
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type RivalTeam = {
  id: number;
  name: string;
  logo_url: string | null;
};

type CurrentTeam = RivalTeam & {
  rival_1_id: number | null;
  rival_2_id: number | null;
  rival_3_id: number | null;
};

type Props = {
  team: CurrentTeam;
  teams: RivalTeam[];
  onSaved?: () => void | Promise<void>;
};

export default function RivalsPanel({
  team,
  teams,
  onSaved,
}: Props) {
  const [rival1, setRival1] =
    useState<number | null>(
      team.rival_1_id
    );

  const [rival2, setRival2] =
    useState<number | null>(
      team.rival_2_id
    );

  const [rival3, setRival3] =
    useState<number | null>(
      team.rival_3_id
    );

  const [editing, setEditing] =
    useState(
      !(
        team.rival_1_id &&
        team.rival_2_id &&
        team.rival_3_id
      )
    );

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const selectedIds = useMemo(
    () =>
      [rival1, rival2, rival3].filter(
        (
          id
        ): id is number =>
          id !== null
      ),
    [rival1, rival2, rival3]
  );

  const allFilled =
    rival1 !== null &&
    rival2 !== null &&
    rival3 !== null;

  const noDuplicates =
    new Set(selectedIds).size ===
    selectedIds.length;

  const canSave =
    allFilled &&
    noDuplicates &&
    !saving;

  const rivalTeams = useMemo(() => {
    return [
      rival1,
      rival2,
      rival3,
    ]
      .map((id) =>
        teams.find(
          (item) =>
            item.id === id
        )
      )
      .filter(
        (
          item
        ): item is RivalTeam =>
          Boolean(item)
      );
  }, [
    rival1,
    rival2,
    rival3,
    teams,
  ]);

  function optionsFor(
    currentValue: number | null
  ) {
    return teams.filter((item) => {
      if (
        item.id === currentValue
      ) {
        return true;
      }

      return !selectedIds.includes(
        item.id
      );
    });
  }

  async function saveRivals() {
    if (!canSave) {
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { error } =
      await supabase
        .from("teams")
        .update({
          rival_1_id: rival1,
          rival_2_id: rival2,
          rival_3_id: rival3,
        })
        .eq(
          "id",
          team.id
        );

    if (error) {
      console.error(
        "Erro ao salvar rivais:",
        error
      );

      setErrorMessage(
        error.message ||
          "Não foi possível salvar os rivais."
      );

      setSaving(false);
      return;
    }

    setEditing(false);
    setSaving(false);

    if (onSaved) {
      await onSaved();
    }
  }

  const completed =
    rivalTeams.length === 3 &&
    !editing;

  return (
    <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">

      <div className="mb-3 flex items-start justify-between gap-4">

        <div>

          <p className="text-xs font-black uppercase tracking-[0.16em] text-green-400">
            Rivais da FriendZone
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            {completed
              ? "3 rivais definidos"
              : "Escolha obrigatoriamente 3 rivais"}
          </p>

        </div>

        {completed && (
          <button
            type="button"
            onClick={() =>
              setEditing(true)
            }
            className="text-xs font-bold text-zinc-500 transition hover:text-white"
          >
            Editar
          </button>
        )}

      </div>

      {completed ? (
        <div className="grid gap-2 sm:grid-cols-3">

          {rivalTeams.map(
            (rival) => (
              <div
                key={rival.id}
                className="flex min-h-[62px] items-center gap-3 rounded-xl border border-green-500/40 bg-zinc-950 px-3 transition hover:border-green-400"
              >

                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">

                  {rival.logo_url ? (
                    <img
                      src={
                        rival.logo_url
                      }
                      alt={`Escudo do ${rival.name}`}
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <span className="text-lg">
                      🛡️
                    </span>
                  )}

                </div>

                <div className="min-w-0">

                  <p className="truncate text-[11px] font-black uppercase text-white">
                    {rival.name}
                  </p>

                  <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-600">
                    Rival
                  </p>

                </div>

              </div>
            )
          )}

        </div>
      ) : (
        <div>

          <div className="grid gap-2 sm:grid-cols-3">

            <RivalSelect
              label="Rival 1"
              value={rival1}
              teams={optionsFor(
                rival1
              )}
              onChange={
                setRival1
              }
            />

            <RivalSelect
              label="Rival 2"
              value={rival2}
              teams={optionsFor(
                rival2
              )}
              onChange={
                setRival2
              }
            />

            <RivalSelect
              label="Rival 3"
              value={rival3}
              teams={optionsFor(
                rival3
              )}
              onChange={
                setRival3
              }
            />

          </div>

          {!noDuplicates && (
            <p className="mt-3 text-xs font-bold text-red-400">
              O mesmo clube não pode ser escolhido duas vezes.
            </p>
          )}

          {errorMessage && (
            <p className="mt-3 text-xs font-bold text-red-400">
              {errorMessage}
            </p>
          )}

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <p
              className={`text-xs font-bold ${
                allFilled &&
                noDuplicates
                  ? "text-green-400"
                  : "text-zinc-500"
              }`}
            >
              {
                selectedIds.length
              }
              /3 rivais selecionados
            </p>

            <div className="flex gap-2">

              {team.rival_1_id &&
                team.rival_2_id &&
                team.rival_3_id && (
                  <button
                    type="button"
                    onClick={() => {
                      setRival1(
                        team.rival_1_id
                      );
                      setRival2(
                        team.rival_2_id
                      );
                      setRival3(
                        team.rival_3_id
                      );
                      setEditing(
                        false
                      );
                      setErrorMessage(
                        ""
                      );
                    }}
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-black uppercase text-zinc-300 transition hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                )}

              <button
                type="button"
                disabled={
                  !canSave
                }
                onClick={
                  saveRivals
                }
                className="rounded-lg bg-green-500 px-5 py-2 text-xs font-black uppercase text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
              >
                {saving
                  ? "Salvando..."
                  : "Salvar rivais"}
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

type RivalSelectProps = {
  label: string;
  value: number | null;
  teams: RivalTeam[];
  onChange: (
    value: number | null
  ) => void;
};

function RivalSelect({
  label,
  value,
  teams,
  onChange,
}: RivalSelectProps) {
  return (
    <div>

      <label className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-zinc-500">
        {label}
      </label>

      <select
        value={
          value ?? ""
        }
        onChange={(event) => {
          const nextValue =
            event.target.value;

          onChange(
            nextValue
              ? Number(
                  nextValue
                )
              : null
          );
        }}
        className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs font-bold text-white outline-none transition focus:border-green-500"
      >
        <option value="">
          Selecionar
        </option>

        {teams.map(
          (item) => (
            <option
              key={
                item.id
              }
              value={
                item.id
              }
            >
              {item.name}
            </option>
          )
        )}

      </select>

    </div>
  );
}
