import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="pixel-panel max-w-xl p-8 bg-white">
        <h1 className="font-display text-2xl text-primary mb-4 leading-relaxed">
          HEIG ODYSSEY
        </h1>
        <p className="text-text-muted mb-6">
          Aventure solo et combats tactiques compétitifs en règles Génération 4.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="pixel-btn bg-primary text-white font-display text-xs px-6 py-3 uppercase tracking-wider"
          >
            Se connecter
          </Link>
          <Link
            href="/signup"
            className="pixel-btn bg-white text-secondary font-display text-xs px-6 py-3 uppercase tracking-wider"
          >
            Créer un compte
          </Link>
        </div>
      </div>
    </main>
  );
}
