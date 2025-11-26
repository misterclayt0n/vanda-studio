"use client";

import { useState } from "react";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Sparkles, ArrowRight, Zap, Camera, Palette, Minimize2, Brush, Loader2, Copy, Check, Download, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import { BackgroundGrid } from "@/components/background-grid";
import { FloatingParticles } from "@/components/floating-particles";

type ImageStyle = "realistic" | "illustrative" | "minimalist" | "artistic";

interface DemoResult {
    success: boolean;
    generatedCaption: string;
    generatedImageBase64?: string;
    generatedImageMimeType?: string;
    reasoning: string;
    sourcePosts: Array<{
        caption: string;
        mediaUrl: string;
        likeCount?: number;
        commentsCount?: number;
    }>;
    brandAnalysis?: {
        brandVoice: string;
        targetAudience: string;
        contentPillars: string[];
    };
    error?: string;
}

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
  const [imageStyle, setImageStyle] = useState<ImageStyle>("realistic");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateDemo = useAction(api.demo.generateDemo);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const demoResult = await generateDemo({
        instagramHandle: handle.trim(),
        additionalContext: context.trim() || undefined,
        imageStyle,
      });

      if (demoResult.success) {
        setResult(demoResult);
      } else {
        setError(demoResult.error || "Erro ao gerar post.");
      }
    } catch (err) {
      console.error("Generation error:", err);
      setError(err instanceof Error ? err.message : "Erro ao gerar post.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Show result if we have one
  if (result) {
    return <DemoResultDisplay result={result} onReset={() => setResult(null)} />;
  }

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
              A Vanda analisa sua grade, posts e gera um novo post.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
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
              disabled={isGenerating}
              className="h-11"
            />
          </div>

          {/* Image style selector */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Estilo da imagem
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "realistic" as const, label: "Realista", icon: Camera, desc: "Foto profissional" },
                { value: "illustrative" as const, label: "Ilustrativo", icon: Palette, desc: "Arte digital" },
                { value: "minimalist" as const, label: "Minimalista", icon: Minimize2, desc: "Clean e simples" },
                { value: "artistic" as const, label: "Artistico", icon: Brush, desc: "Criativo e ousado" },
              ].map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => setImageStyle(style.value)}
                  disabled={isGenerating}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                    imageStyle === style.value
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/50",
                    isGenerating && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    imageStyle === style.value ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <style.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{style.label}</p>
                    <p className="text-xs text-muted-foreground">{style.desc}</p>
                  </div>
                </button>
              ))}
            </div>
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
              disabled={isGenerating}
              className="resize-none"
            />
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="pt-2">
            <Button
              type="submit"
              variant="gradient"
              className="w-full"
              size="lg"
              disabled={isGenerating || !handle.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando post...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Gerar Post de Demonstracao
                </>
              )}
            </Button>
            {isGenerating && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                Isso pode levar ate 1 minuto...
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function DemoResultDisplay({ result, onReset }: { result: DemoResult; onReset: () => void }) {
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.generatedCaption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result.generatedImageBase64 || !result.generatedImageMimeType) return;
    const link = document.createElement("a");
    link.href = `data:${result.generatedImageMimeType};base64,${result.generatedImageBase64}`;
    link.download = "vanda-studio-demo.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const imageDataUrl = result.generatedImageBase64 && result.generatedImageMimeType
    ? `data:${result.generatedImageMimeType};base64,${result.generatedImageBase64}`
    : null;

  return (
    <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-purple flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Seu Post Gerado</CardTitle>
                <CardDescription>
                  Baseado na analise da sua marca
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onReset}>
              Gerar outro
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Generated Image */}
            <div className="relative aspect-square bg-muted">
              {imageDataUrl && !imageError ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageDataUrl}
                    alt="Post gerado por IA"
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute top-3 right-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="shadow-lg"
                      onClick={handleDownload}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Baixar
                    </Button>
                  </div>
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-600/90 text-white text-xs font-medium shadow-lg">
                      <Sparkles className="h-3 w-3" />
                      IA
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 opacity-30" />
                  <p className="text-sm">Imagem nao disponivel</p>
                </div>
              )}
            </div>

            {/* Caption and Info */}
            <div className="p-6 flex flex-col">
              {/* Caption */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Legenda Gerada
                  </Label>
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 border mb-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {result.generatedCaption}
                  </p>
                </div>

                {/* Reasoning */}
                {result.reasoning && (
                  <details className="text-sm text-muted-foreground mb-4">
                    <summary className="cursor-pointer hover:text-foreground transition-colors font-medium">
                      Por que essa legenda?
                    </summary>
                    <p className="mt-2 pl-4 border-l-2 border-muted">{result.reasoning}</p>
                  </details>
                )}

                {/* Brand Analysis */}
                {result.brandAnalysis && (
                  <div className="space-y-3 pt-4 border-t">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Analise da Marca
                    </p>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="text-muted-foreground">Voz:</span>{" "}
                        {result.brandAnalysis.brandVoice}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Publico:</span>{" "}
                        {result.brandAnalysis.targetAudience}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {result.brandAnalysis.contentPillars.map((pillar, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
                          >
                            {pillar}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Source posts preview */}
              {result.sourcePosts.length > 0 && (
                <div className="pt-4 border-t mt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                    Posts Analisados
                  </p>
                  <div className="flex gap-2">
                    {result.sourcePosts.slice(0, 3).map((post, i) => (
                      <div key={i} className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={post.mediaUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="mt-8 text-center">
        <p className="text-muted-foreground mb-4">
          Gostou? Crie uma conta para gerar posts ilimitados.
        </p>
        <SignedOut>
          <SignInButton mode="modal">
            <Button variant="gradient" size="lg">
              <Sparkles className="h-4 w-4" />
              Criar Conta Gratis
            </Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <Button variant="gradient" size="lg" asChild>
            <a href="/dashboard">
              <ArrowRight className="h-4 w-4" />
              Ir para o Dashboard
            </a>
          </Button>
        </SignedIn>
      </div>
    </div>
  );
}
