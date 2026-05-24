import { supabase } from "@/lib/supabase";
import BidForm from "./BidForm";
import AuctionTimer from "./AuctionTimer";
export default async function PlayerPage({ params }: any) {
  const { id } = await params;

  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("id", id)
    .single();
const { data: bids } = await supabase
  .from("bids")
  .select("*")
  .eq("player_id", id)
  .order("bid_amount", { ascending: false });
  const highestBid = bids?.[0];
  if (!player) {
    return (
      <main className="min-h-screen bg-zinc-900 text-white p-10">
        Jogador não encontrado
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-900 text-white p-10">
      <h1 className="text-5xl font-bold">{player.name}</h1>

      <p className="text-2xl mt-4">{player.position}</p>
      <p className="mt-2">{player.age} anos</p>

      <p className="text-green-400 text-3xl mt-6">
        Valor inicial: ${player.starting_price}
      </p>

      <BidForm playerId={player.id} />
      <div className="mt-10">
  <h2 className="text-3xl font-bold mb-4">
    Ofertas
  </h2>
{highestBid && (
  <div className="mt-10 bg-green-900 border border-green-500 p-6 rounded-2xl">
    <h2 className="text-2xl font-bold text-green-300">
      Maior oferta atual
    </h2>

    <p className="text-4xl font-bold mt-3">
      ${highestBid.bid_amount}
    </p>

    <p className="mt-2">
      Clube/Usuário: {highestBid.user_name}
    </p>
  </div>
)}
  <div className="space-y-4">
    {bids?.map((bid) => (
      <div
        key={bid.id}
        className="bg-zinc-800 p-4 rounded-xl"
      >
        <p className="font-bold text-xl">
          {bid.user_name}
        </p>

        <p className="text-zinc-400">
          {bid.whatsapp}
        </p>
<AuctionTimer endDate={player.auction_end} />
        <p className="text-green-400 text-2xl mt-2">
          ${bid.bid_amount}
        </p>
      </div>
    ))}
  </div>
</div>
</main>
);
}