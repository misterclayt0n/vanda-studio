"use client";

import { useState } from "react";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050211] text-white">
      <BackgroundAura />
      <div className="relative z-10 flex min-h-screen flex-col">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 pb-12 pt-16 text-center md:pt-20">
          <Hero />
        </main>
      </div>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-6 text-sm text-white/70">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#C084FC] via-[#A855F7] to-[#7C3AED] text-lg font-semibold text-white">
          VS
        </div>
        <div className="text-left">
          <p className="text-xs uppercase tracking-[0.4em] text-white/60">
            Vanda Studio
          </p>
          <p className="text-white/80">Reformulações conceituais em um toque</p>
        </div>
      </div>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="rounded-full border border-white/20 px-4 py-2 text-white/80 transition hover:border-white/60 hover:text-white">
            Entrar
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton appearance={{ elements: { avatarBox: "h-10 w-10" } }} />
      </SignedIn>
    </header>
  );
}

function Hero() {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <>
      <div className="space-y-6">
        <p className="text-xs uppercase tracking-[0.6em] text-white/40">
          SALA DE CONCEITOS
        </p>
        <h1 className="text-4xl font-medium leading-tight text-white sm:text-5xl md:text-6xl">
          Envie um @. Veja a Vanda repintar a narrativa.
        </h1>
        <p className="mx-auto max-w-2xl text-base text-white/70 md:text-lg">
          Esta é a maneira mais simples de mostrar aos clientes o que é
          possível. Um link do Instagram entra e uma narrativa, clima e direção
          de conteúdo refinados saem — antes mesmo de você abrir um deck.
        </p>
        <button
          onClick={() => setShowPrompt(true)}
          className="group relative mx-auto mt-4 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/5 px-8 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-white transition hover:border-white/40 hover:bg-white/10"
        >
          <span className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-[#A855F7] via-[#EC4899] to-transparent opacity-0 blur-2xl transition group-hover:opacity-40" />
          INICIAR REFORMULAÇÃO
          <span className="h-2 w-2 rounded-full bg-white/80 animate-pulse" />
        </button>
      </div>

      <PromptPanel open={showPrompt} />
    </>
  );
}

type PromptPanelProps = {
  open: boolean;
};

function PromptPanel({ open }: PromptPanelProps) {
  const [url, setUrl] = useState("");
  const [context, setContext] = useState("");

  return (
    <div
      className={`relative mt-12 w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-1 transition-all duration-500 ${
        open ? "opacity-100" : "pointer-events-none -translate-y-4 opacity-0"
      }`}
    >
      <div className="rounded-[28px] border border-white/10 bg-[#070214]/90 p-8 text-left shadow-2xl shadow-black/40">
        <div className="flex flex-col gap-2 text-sm text-white/60">
          <p className="text-xs uppercase tracking-[0.5em] text-white/40">
            ENTRADA DA REFORMULAÇÃO
          </p>
          <h2 className="text-2xl font-semibold text-white">
            O que devemos reimaginar primeiro?
          </h2>
          <p>
            A Vanda analisa sua grade, cadência de posts e comentários. Adicione
            casos extremos ou limites abaixo para ensinar ao modelo como você
            apresenta propostas.
          </p>
        </div>
        <form className="mt-6 space-y-5">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.4em] text-white/40">
              URL DO INSTAGRAM OU REDE SOCIAL
            </span>
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://instagram.com/sua-marca"
              className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/70 focus:outline-none"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.4em] text-white/40">
              CONTEXTO ADICIONAL
            </span>
            <textarea
              value={context}
              onChange={(event) => setContext(event.target.value)}
              placeholder="Tom, campanhas para destacar, públicos para perseguir ou qualquer coisa de que seus interessados não abrem mão."
              rows={4}
              className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/70 focus:outline-none"
            />
          </label>
          <SignedIn>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#EC4899] px-6 py-3 text-sm font-semibold uppercase tracking-[0.5em] text-white transition hover:opacity-90"
            >
              GERAR PRÉVIA DA REFORMULAÇÃO
            </button>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button
                type="button"
                className="w-full rounded-2xl border border-white/30 px-6 py-3 text-sm font-semibold uppercase tracking-[0.5em] text-white/80 transition hover:text-white"
              >
                ENTRAR PARA ENVIAR
              </button>
            </SignInButton>
          </SignedOut>
        </form>
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 animate-blob rounded-[32px] bg-gradient-to-r from-[#7C3AED]/20 via-[#EC4899]/20 to-transparent blur-3xl" />
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
