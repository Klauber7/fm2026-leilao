"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function BidForm({ playerId }: { playerId: string }) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [value, setValue] = useState("");

  async function handleBid() {
    const { error } = await supabase.from("bids").insert({
      player_id: playerId,
      user_name: name,
      whatsapp: whatsapp,
      bid_amount: Number(value),
    });

    if (error) {
      alert("Erro ao enviar oferta");
      return;
    }

    alert("Oferta enviada com sucesso!");
    setName("");
    setWhatsapp("");
    setValue("");
  }

  return (
    <div className="mt-8 max-w-sm">
      <input
        placeholder="Seu nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white w-full mb-3"
      />

      <input
        placeholder="Seu WhatsApp"
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
        className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white w-full mb-3"
      />

      <input
        type="number"
        placeholder="Valor da oferta"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white w-full"
      />

      <button
        onClick={handleBid}
        className="bg-green-600 px-6 py-3 rounded-xl mt-4 text-xl block"
      >
        Confirmar oferta
      </button>
    </div>
  );
}