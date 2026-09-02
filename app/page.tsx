import Link from "next/link";

export default function Home() {
  return (
    <main className="bg-zinc-950 text-white">

      <section className="border-b border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-green-950">
        <div className="max-w-7xl mx-auto px-8 py-24">

          <p className="text-green-400 font-bold uppercase tracking-widest">
            TEMPORADA 2026
          </p>

          <h1 className="text-7xl font-black mt-4">
            FriendZone League FM
          </h1>

          <p className="text-zinc-300 text-2xl mt-6 max-w-3xl">
            Construa seu elenco.
            Vença a liga.
            Faça história.
          </p>

          <div className="flex gap-4 mt-10">

            <Link
              href="/players"
              className="bg-green-600 hover:bg-green-500 px-8 py-4 rounded-xl font-bold"
            >
              Mercado
            </Link>

            <Link
              href="/teams"
              className="border border-zinc-700 hover:border-green-500 px-8 py-4 rounded-xl font-bold"
            >
              Clubes
            </Link>

          </div>

        </div>
      </section>

      <section className="max-w-7xl mx-auto px-8 py-16">

        <div className="grid md:grid-cols-4 gap-6">

          <div className="bg-zinc-900 rounded-2xl p-8">
            <p className="text-zinc-400">Clubes</p>
            <h2 className="text-5xl font-black mt-2">20</h2>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-8">
            <p className="text-zinc-400">Jogadores</p>
            <h2 className="text-5xl font-black mt-2">15.000</h2>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-8">
            <p className="text-zinc-400">Treinadores</p>
            <h2 className="text-5xl font-black mt-2">500</h2>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-8">
            <p className="text-zinc-400">Orçamento Total</p>
            <h2 className="text-3xl font-black mt-2 text-green-400">
              R$ 6 Bi
            </h2>
          </div>

        </div>

      </section>

    </main>
  );
}