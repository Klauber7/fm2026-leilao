"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PremierResultAdmin from "@/app/premier-league/PremierResultAdmin";

export default function AdminPremierLeaguePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) { router.replace("/login"); return; }
      const { data: role, error } = await supabase.rpc("get_my_admin_role");
      if (!active) return;
      if (error || (role !== "owner" && role !== "master")) {
        router.replace("/dashboard");
        return;
      }
      setAuthorized(true);
      setLoading(false);
    }
    void checkAccess();
    return () => { active = false; };
  }, [router]);

  if (loading) return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
      Carregando administração...
    </main>
  );
  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl">
        <PremierResultAdmin />
      </div>
    </main>
  );
}
