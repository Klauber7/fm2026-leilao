"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type MarketPlayer = { id: number; name: string };
type Listing = {
  id: string;
  player_id: number;
  team_id: number;
  asking_price: number;
  player: { name: string; position: string | null };
  team: { name: string };
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const field = "rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white";

function fetchListings() {
  return supabase
    .from("internal_player_listings")
    .select("id, player_id, team_id, asking_price, player:players!inner(name, position), team:teams!inner(name)")
    .order("created_at", { ascending: false })
    .returns<Listing[]>();
}

export default function InternalMarket({ teamId }: { teamId: number | null }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [roster, setRoster] = useState<MarketPlayer[]>([]);
  const [playerId, setPlayerId] = useState("");
  const [price, setPrice] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadListings() {
    const { data, error } = await fetchListings();
    if (error) {
      setMessage("Não foi possível carregar os anúncios.");
      return false;
    }
    setListings(data);
    return true;
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    void fetchListings().then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage("Não foi possível carregar os anúncios.");
      else setListings(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [signedIn]);

  useEffect(() => {
    if (!teamId) return;
    let active = true;
    void supabase.from("players").select("id, name").eq("team_id", teamId)
      .order("name").then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage("Não foi possível carregar o seu elenco.");
        else setRoster(data);
      });
    return () => { active = false; };
  }, [teamId]);

  const selectedListing = listings.find((listing) => listing.team_id === teamId && String(listing.player_id) === playerId);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teamId || busy) return;
    const amount = Number(price.replace(",", "."));
    if (!playerId || !/^\d+(?:[,.]\d{1,2})?$/.test(price) || amount <= 0 || amount > 1e12) {
      setMessage("Selecione um jogador e informe um valor válido, sem separador de milhar.");
      return;
    }
    setBusy(true);
    setMessage("");
    const request = selectedListing
      ? supabase.from("internal_player_listings").update({ asking_price: amount }).eq("player_id", playerId).eq("team_id", teamId)
      : supabase.from("internal_player_listings").insert({ player_id: Number(playerId), team_id: teamId, asking_price: amount });
    const { data, error } = await request.select("player_id").maybeSingle();
    if (error || !data) {
      setMessage(error?.code === "23505" ? "Este jogador já tem um anúncio. A lista foi atualizada." : "Não foi possível salvar o anúncio. Confira se o jogador ainda está no seu elenco.");
      if (error?.code === "23505") await loadListings();
    } else {
      setPlayerId("");
      setPrice("");
      if (await loadListings()) setMessage(selectedListing ? "Preço atualizado." : "Jogador anunciado.");
    }
    setBusy(false);
  }

  async function remove(listing: Listing) {
    if (!teamId || busy) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.from("internal_player_listings")
      .delete().eq("player_id", listing.player_id).eq("team_id", teamId).select("player_id").maybeSingle();
    if (error || !data) setMessage("Não foi possível retirar o anúncio.");
    else {
      if (playerId === String(listing.player_id)) {
        setPlayerId("");
        setPrice("");
      }
      if (await loadListings()) setMessage("Anúncio retirado.");
    }
    setBusy(false);
  }

  return (
    <section id="mercado-interno" aria-labelledby="internal-market-heading" className="mb-5 scroll-mt-20 rounded-2xl border border-emerald-500/30 bg-zinc-900 p-4 sm:p-5">
      <h2 id="internal-market-heading" className="text-2xl font-black text-emerald-300">Mercado Interno</h2>
      <p className="mt-1 text-sm text-zinc-400">Jogadores anunciados pelos clubes da FriendZone. Clique em um anúncio para montar sua proposta.</p>

      {signedIn && teamId && (
        <form onSubmit={publish} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid w-full gap-1 text-xs font-bold text-zinc-300 sm:w-auto">
            Jogador do seu elenco
            <select required value={playerId} className={field} disabled={busy} onChange={(event) => {
              const id = event.target.value;
              const listing = listings.find((item) => String(item.player_id) === id);
              setPlayerId(id);
              setPrice(listing ? String(listing.asking_price).replace(".", ",") : "");
            }}>
              <option value="">Selecione um jogador</option>
              {roster.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-zinc-300">
            Preço pedido (R$)
            <input required inputMode="decimal" placeholder="Ex. 15000000" className={field}
              value={price} onChange={(event) => setPrice(event.target.value)} disabled={busy} />
          </label>
          <button disabled={busy || !playerId} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-zinc-950 disabled:opacity-50">
            {selectedListing ? "Atualizar preço" : "Anunciar jogador"}
          </button>
        </form>
      )}

      {signedIn && message && <p role="status" className="mt-3 text-sm text-zinc-200">{message}</p>}
      {signedIn === false && <Link href="/login" className="mt-3 inline-block text-sm font-bold text-emerald-300">Entre para ver os anúncios</Link>}
      {signedIn && loading && <p className="mt-3 text-sm text-zinc-400">Carregando anúncios…</p>}
      {signedIn && !loading && !listings.length && !message && <p className="mt-3 text-sm text-zinc-400">Nenhum jogador anunciado.</p>}

      {signedIn && listings.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => {
            const own = listing.team_id === teamId;
            const details = (
              <>
                <p className="font-black text-white">{listing.player.name}</p>
                <p className="text-xs text-zinc-400">{[listing.team.name, listing.player.position].filter(Boolean).join(" · ")}</p>
                <p className="mt-1 text-sm font-bold text-emerald-300">{money.format(listing.asking_price)}</p>
              </>
            );
            return (
              <li key={listing.id} className="rounded-xl border border-zinc-700 bg-zinc-950">
                {own ? (
                  <div className="flex items-center justify-between gap-2 p-3">
                    <div>{details}</div>
                    <button type="button" disabled={busy} onClick={() => void remove(listing)}
                      className="text-xs font-bold text-zinc-300 hover:text-white disabled:opacity-50">Retirar</button>
                  </div>
                ) : (
                  <Link href={`/transfers/negotiations/new?listing=${listing.id}`} className="block rounded-xl p-3 hover:bg-zinc-800">
                    {details}
                    <span className="mt-2 inline-block text-xs font-bold text-zinc-300">Fazer proposta →</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
