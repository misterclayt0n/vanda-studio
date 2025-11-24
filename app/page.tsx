"use client";

import { useState } from "react";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container mx-auto flex flex-col items-center justify-center px-4 py-16 text-center md:py-24">
        <Hero />
      </main>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="container mx-auto flex items-center justify-between px-4 py-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
          VS
        </div>
        <div className="text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Vanda Studio
          </p>
          <p className="text-sm text-muted-foreground">Social media as a service</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <SignedOut>
          <SignInButton mode="modal">
            <Button variant="outline">Entrar</Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <UserButton appearance={{ elements: { avatarBox: "h-10 w-10" } }} />
        </SignedIn>
      </div>
    </header>
  );
}

function Hero() {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className="flex w-full max-w-3xl flex-col items-center space-y-8">
      <div className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Sala de Conceitos
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
          Social media as a service. <br className="hidden md:inline" />
          Envie um @ e veja a Vanda repintar a narrativa.
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Cole o link do Instagram da sua loja. A Vanda devolve em minutos uma
          narrativa clara, o clima e ideias de conteúdo prontas para usar.
        </p>
      </div>

      {!showPrompt ? (
        <Button size="lg" onClick={() => setShowPrompt(true)}>
          Iniciar Reformulação
        </Button>
      ) : (
        <PromptPanel />
      )}
    </div>
  );
}

function PromptPanel() {
  const [url, setUrl] = useState("");
  const [context, setContext] = useState("");

  return (
    <Card className="w-full text-left animate-in fade-in zoom-in-95 duration-300">
      <CardHeader>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Entrada da Reformulação
        </p>
        <CardTitle className="text-2xl">O que devemos reimaginar primeiro?</CardTitle>
        <CardDescription>
          A Vanda analisa sua grade, cadência de posts e comentários. Adicione
          casos extremos ou limites abaixo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="url" className="text-xs uppercase tracking-widest text-muted-foreground">
              URL do Instagram ou Rede Social
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="https://instagram.com/sua-marca"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="context" className="text-xs uppercase tracking-widest text-muted-foreground">
              Contexto Adicional
            </Label>
            <Textarea
              id="context"
              placeholder="Tom, campanhas para destacar, públicos para perseguir..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={4}
            />
          </div>
          <div className="pt-2">
            <SignedIn>
              <Button type="submit" className="w-full">
                Gerar Prévia da Reformulação
              </Button>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <Button type="button" variant="secondary" className="w-full">
                  Entrar para Enviar
                </Button>
              </SignInButton>
            </SignedOut>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
