"use client";

export default function OfflinePage() {
  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center bg-background text-foreground">
      <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-5">
        <span className="text-xl font-black text-primary">IB</span>
      </div>
      <h1 className="text-xl font-bold tracking-tight">Você está offline</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
        O IBANK precisa de conexão para carregar seus dados financeiros.
        Reconecte e tente novamente.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 min-h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
      >
        Tentar de novo
      </button>
    </main>
  );
}
