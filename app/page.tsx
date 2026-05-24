import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-5xl font-bold mb-6">
        FM2026 Leilão
      </h1>

      <p className="text-xl mb-8">
        Bem-vindo ao mercado de transferências.
      </p>

      <Link
        href="/players"
        className="bg-green-600 px-6 py-3 rounded-xl text-lg"
      >
        Ver jogadores
      </Link>
    </main>
  );
}