"use client";

import { useEffect, useState } from "react";

export default function AuctionTimer({ endDate }: { endDate: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function updateTimer() {
      const end = new Date(endDate).getTime();
      const now = new Date().getTime();
      const distance = end - now;

      if (distance <= 0) {
        setTimeLeft("Leilão encerrado");
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((distance / (1000 * 60)) % 60);
      const seconds = Math.floor((distance / 1000) % 60);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    }

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [endDate]);

  return (
    <div className="mt-6 bg-zinc-800 p-5 rounded-2xl max-w-sm">
      <p className="text-zinc-400">Leilão termina em:</p>
      <p className="text-3xl font-bold text-yellow-400 mt-2">
        {timeLeft}
      </p>
    </div>
  );
}