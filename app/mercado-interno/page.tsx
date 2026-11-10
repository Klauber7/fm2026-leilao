"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { getPositionGroups, POSITION_SECTIONS, type PositionGroup } from "@/lib/squad-positions";
import { supabase } from "@/lib/supabase";

type MarketPlayer = { id: number; name: string };
type Listing = {
  id: string;
  player_id: number;
  team_id: number;
  asking_price: number;
  player: {
    name: string;
    value: number | null;
    position: string | null;
    natural_position: string | null;
    category: string[] | null;
    position_ratings: number[] | null;
  };
  team: { name: string };
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const field = "rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white";

function fetchListings() {
  return supabase
    .from("internal_player_listings")
    .select("id, player_id, team_id, asking_price, player:players!inner(name, value, position, natural_position, category, position_ratings), team:teams!inner(name)")
    .order("asking_price", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<Listing[]>();
}

export default function InternalMarketPage() {
  const [userId, setUserId] = useState<string | null>();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-[1550px] px-4 py-5">
        <InternalMarket key={userId ?? "visitor"} userId={userId} />
      </div>
    </main>
  );
}

function InternalMarket({ userId }: { userId: string | null | undefined }) {
  const signedIn = Boolean(userId);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [position, setPosition] = useState<PositionGroup | "all">("all");
  const [roster, setRoster] = useState<MarketPlayer[]>([]);
  const [playerId, setPlayerId] = useState("");
  const [price, setPrice] = useState("");
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
    if (!userId) return;
    let active = true;
    void supabase.from("teams").select("id").eq("manager_id", userId)
      .maybeSingle().then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage("Não foi possível identificar o seu clube.");
        else setTeamId(data?.id ?? null);
      });
    return () => { active = false; };
  }, [userId]);

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

  const filteredListings = position === "all"
    ? listings
    : listings.filter((listing) => getPositionGroups(listing.player).includes(position));
  const selectedListing = listings.find((listing) => listing.team_id === teamId && String(listing.player_id) === playerId);

  const amount = Number(price.replace(",", "."));
  const validPrice = /^\d+(?:[,.]\d{1,2})?$/.test(price) && amount > 0 && amount <= 1e12;

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teamId || busy) return;
    if (!playerId || !validPrice) {
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
    <section aria-labelledby="internal-market-heading" className="mb-5 rounded-2xl border border-emerald-500/30 bg-zinc-900 p-4 sm:p-5">
      <h1 id="internal-market-heading" className="text-3xl font-black text-emerald-300 sm:text-4xl">Mercado Interno</h1>
      <p className="mt-1 text-sm text-zinc-400">Jogadores anunciados pelos clubes da FriendZone. Clique em um jogador para ver os atributos e fazer uma oferta.</p>

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
          <div className="grid w-full gap-1 sm:w-auto">
            <label htmlFor="internal-market-price" className="text-xs font-bold text-zinc-300">Preço pedido (R$)</label>
            <input id="internal-market-price" required inputMode="decimal" placeholder="Ex. 15000000" className={field}
              value={price} onChange={(event) => setPrice(event.target.value)} disabled={busy} />
            <output htmlFor="internal-market-price" className="mt-1 text-sm text-zinc-400">
              Total em dinheiro: {validPrice || !price ? `R$ ${amount.toLocaleString("pt-BR")}` : "—"}
            </output>
          </div>
          <button disabled={busy || !playerId} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-zinc-950 disabled:opacity-50">
            {selectedListing ? "Atualizar preço" : "Anunciar jogador"}
          </button>
        </form>
      )}

      {signedIn && message && <p role="status" className="mt-3 text-sm text-zinc-200">{message}</p>}
      {userId === null && <Link href="/login" className="mt-3 inline-block text-sm font-bold text-emerald-300">Entre para ver os anúncios</Link>}
      {signedIn && (
        <div className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-2 border-t border-zinc-800 pt-4">
          <label className="grid w-full gap-1 text-sm font-bold text-zinc-300 sm:w-auto">
            Pesquisar por posição
            <select value={position} className={field} onChange={(event) => setPosition(event.target.value as PositionGroup | "all")}>
              <option value="all">Todas as posições</option>
              {POSITION_SECTIONS.map(({ key, title }) => <option key={key} value={key}>{title}</option>)}
              <option value="others">Sem posição definida</option>
            </select>
          </label>
          <p className="pb-2 text-sm text-zinc-400">Do maior para o menor preço pedido</p>
        </div>
      )}
      {signedIn && loading && <p className="mt-3 text-sm text-zinc-400">Carregando anúncios…</p>}
      {signedIn && !loading && !listings.length && !message && <p className="mt-3 text-sm text-zinc-400">Nenhum jogador anunciado.</p>}

      {signedIn && !loading && listings.length > 0 && filteredListings.length === 0 && (
        <p className="mt-3 text-sm text-zinc-400">Nenhum jogador anunciado nessa posição.</p>
      )}

      {signedIn && filteredListings.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredListings.map((listing) => {
            return (
              <li key={listing.id} className="rounded-xl border border-zinc-700 bg-zinc-950">
                <Link href={`/players/${listing.player_id}?listing=${listing.id}`} className="block rounded-xl p-3 hover:bg-zinc-800">
                  <p className="font-black text-white">{listing.player.name}</p>
                  <p className="text-xs text-zinc-400">{[listing.team.name, listing.player.position].filter(Boolean).join(" · ")}</p>
                  <dl className="mt-2 grid gap-1 text-sm">
                    <div className="flex flex-wrap justify-between gap-x-2 text-zinc-300">
                      <dt>Valor atual</dt>
                      <dd>{listing.player.value == null ? "Indisponível" : money.format(listing.player.value)}</dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-2 font-bold text-emerald-300">
                      <dt>Preço pedido pelo clube</dt>
                      <dd>{money.format(listing.asking_price)}</dd>
                    </div>
                  </dl>
                  <span className="mt-2 inline-block text-xs font-bold text-zinc-300">Ver atributos →</span>
                </Link>
                {listing.team_id === teamId && (
                  <button type="button" disabled={busy} onClick={() => void remove(listing)}
                    className="px-3 pb-3 text-xs font-bold text-zinc-300 hover:text-white disabled:opacity-50">Retirar anúncio</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
