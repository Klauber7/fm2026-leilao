import Link from "next/link";

export default function Home() {
  return (
    <main className="bg-zinc-950 text-white">

      <section className="border-b border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-green-950">
        <div className="max-w-7xl mx-auto px-8 py-24">

          <p className="text-green-400 font-bold uppercase tracking-widest">
            TEMPORADA 1
          </p>

          <h1 className="text-7xl font-black mt-4">
            FriendZone League FM
          </h1>

          <p className="text-zinc-300 text-2xl mt-6 max-w-3xl">
            Construa seu elenco.
            Vença a liga.
            Faça história.
          </p>

          <div className="mt-10">

            <Link
              href="/login"
              className="inline-block bg-green-600 hover:bg-green-500 px-10 py-4 rounded-xl font-bold"
            >
              Entre
            </Link>

          </div>

        </div>
      </section>

      <section className="max-w-7xl mx-auto px-8 py-16">

        <div className="grid md:grid-cols-3 gap-6">

          <div className="bg-zinc-900 rounded-2xl p-8">
            <p className="text-zinc-400">Clubes</p>
            <h2 className="text-5xl font-black mt-2">20</h2>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-8">
            <p className="text-zinc-400">Presidentes</p>
            <h2 className="text-5xl font-black mt-2">20</h2>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-8">
            <p className="text-zinc-400">Competições</p>
            <h2 className="text-5xl font-black mt-2">4</h2>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-8">
            <p className="text-zinc-400">Orçamento por Clube</p>
            <h2 className="text-3xl font-black mt-2 text-green-400">
              R$ 400M
            </h2>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-8">
            <p className="text-zinc-400">Transmissões</p>
            <h2 className="text-3xl font-black mt-2 text-green-400">
              Jogos ao Vivo no YouTube
            </h2>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-8">
            <p className="text-zinc-400">Canal Oficial</p>

            <a
              href="https://www.youtube.com/@FriendZoneFM"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-3 rounded-xl bg-green-600 px-6 py-3 font-black text-white transition hover:bg-green-500"
            >
              <span className="text-2xl">▶️</span>
              Clique aqui
            </a>
          </div>

        </div>

      </section>

    </main>
  );
}