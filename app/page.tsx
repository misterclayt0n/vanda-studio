"use client";

import { useState } from "react";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
// import { ModeToggle } from "@/components/mode-toggle";
import { Sparkles, ArrowRight, Zap } from "lucide-react";

import { BackgroundGrid } from "@/components/background-grid";
import { FloatingParticles } from "@/components/floating-particles";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <BackgroundGrid />
      <FloatingParticles />
      <SiteHeader />
      <main className="container mx-auto flex flex-col items-center justify-center px-4 py-16 text-center md:py-24 relative z-10">
        <Hero />
      </main>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="container mx-auto flex items-center justify-between px-4 py-6 relative z-10">
      <div className="flex items-center gap-3 group">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-purple text-white font-bold text-sm shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all duration-300 group-hover:scale-105">
          VS
        </div>
        <div className="text-left">
          <p className="text-sm font-bold tracking-tight text-foreground">
            Vanda Studio
          </p>
          <p className="text-xs text-muted-foreground">Social media as a service</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SignedOut>
          <SignInButton mode="modal">
            <Button variant="outline" size="sm">Entrar</Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <Button variant="ghost" size="sm" asChild>
            <a href="/dashboard">Dashboard</a>
          </Button>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-8 w-8 ring-2 ring-border hover:ring-primary transition-all",
                userButtonTrigger: "focus:shadow-none focus-visible:outline-none p-0",
                userButtonPopoverCard: "bg-popover border border-border shadow-lg",
                userButtonPopoverActionButton: "hover:bg-muted",
                userButtonPopoverActionButtonText: "text-foreground",
                userButtonPopoverFooter: "hidden",
              },
            }}
          />
        </SignedIn>
        {/* <ModeToggle /> */}
      </div>
    </header>
  );
}

function Hero() {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className="flex w-full max-w-4xl flex-col items-center space-y-10">
      {/* Badge */}
      <div className="animate-float-slow">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary backdrop-blur-sm">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="font-medium">Sala de Conceitos</span>
          <span className="h-1 w-1 rounded-full bg-primary/50" />
          <span className="text-muted-foreground">Beta</span>
        </div>
      </div>

      {/* Main heading */}
      <div className="space-y-6">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          <span className="text-gradient">Social media</span>
          <br className="hidden sm:inline" />
          <span className="text-foreground"> as a service.</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
          Digite o @ da sua marca e a Vanda faz uma
          <span className="text-foreground font-medium"> análise completa</span>:
          identifica o que funciona, o que falta e entrega
          <span className="text-foreground font-medium"> ideias de posts prontas </span>
          para você usar.
        </p>
      </div>

      {/* CTA Section */}
      {!showPrompt ? (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Button
            variant="gradient"
            size="lg"
            onClick={() => setShowPrompt(true)}
            className="group"
          >
            <Zap className="h-4 w-4" />
            Analisar meu Instagram
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="outline" size="lg">
                Fazer Login
              </Button>
            </SignInButton>
          </SignedOut>
        </div>
      ) : (
        <PromptPanel />
      )}

      {/* Trust badges */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground pt-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span>Análise em tempo real</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span>+500 marcas analisadas</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-accent" />
          <span>Resultados em minutos</span>
        </div>
      </div>
    </div>
  );
}

function PromptPanel() {
  const [handle, setHandle] = useState("");
  const [context, setContext] = useState("");

  return (
    <Card className="w-full max-w-2xl text-left animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-purple flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl">Qual Instagram vamos analisar?</CardTitle>
            <CardDescription>
              A Vanda analisa sua grade, posts e engajamento.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="handle" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              @ do Instagram
            </Label>
            <Input
              id="handle"
              type="text"
              placeholder="@suamarca"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="context" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Contexto Adicional <span className="text-muted-foreground/60">(opcional)</span>
            </Label>
            <Textarea
              id="context"
              placeholder="Tom desejado, campanhas para destacar, públicos-alvo..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="pt-2">
            <SignedIn>
              <Button type="submit" variant="gradient" className="w-full" size="lg">
                <Zap className="h-4 w-4" />
                Gerar Análise
              </Button>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <Button type="button" variant="outline" className="w-full" size="lg">
                  Entrar para Continuar
                </Button>
              </SignInButton>
            </SignedOut>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
