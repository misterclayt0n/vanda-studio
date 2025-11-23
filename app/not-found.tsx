"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#050211] px-6 text-center text-white">
      <BackgroundAura />
      <div className="relative z-10 max-w-2xl space-y-6">
        <p className="text-xs uppercase tracking-[0.6em] text-white/40">
          página não encontrada
        </p>
        <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
          Parece que essa história ainda não foi reimaginada.
        </h1>
        <p className="text-base text-white/70">
          O link que você tentou acessar não existe ou foi movido. Volte ao
          painel inicial para continuar sua experiência com a Vanda Studio.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-white transition hover:border-white/60"
          >
            VOLTAR PARA A HOME
          </Link>
        </div>
      </div>
    </div>
  );
}

function BackgroundAura() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute left-1/2 top-20 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#a855f7]/30 via-[#7c3aed]/40 to-transparent blur-[140px]" />
      <div className="animate-blob absolute -left-16 bottom-0 h-[320px] w-[320px] rounded-full bg-gradient-to-br from-[#ec4899]/30 via-[#a855f7]/20 to-transparent blur-[160px]" />
      <div className="animate-blob-slow absolute -right-24 top-40 h-[360px] w-[360px] rounded-full bg-gradient-to-br from-[#38BDF8]/10 via-[#c084fc]/20 to-transparent blur-[160px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#2B0A4D_0%,transparent_50%)] opacity-50" />
    </div>
  );
}
