"use client";

import { useState, useEffect } from "react";
import { SignInButton, SignedIn, SignedOut, UserButton, useAuth } from "@clerk/nextjs";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiMagicIcon,
  ArrowRight01Icon,
  FlashIcon,
  MegaphoneIcon,
  BriefcaseIcon,
  CommentAdd01Icon,
  Loading01Icon,
  Copy01Icon,
  Tick02Icon,
  Download01Icon,
  Image01Icon,
  Alert01Icon,
} from "@hugeicons/core-free-icons";

// Generate a simple browser fingerprint for rate limiting
function generateFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset().toString(),
    screen.width.toString(),
    screen.height.toString(),
    screen.colorDepth.toString(),
  ];

  // Simple hash function
  const str = components.join("|");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PostType = "promocao" | "conteudo_profissional" | "engajamento";

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
    hasLimitedContext?: boolean;
}

export default function Home() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="container mx-auto flex flex-col items-center justify-center px-4 py-12 text-center md:py-20 relative z-10">
        <Hero />
      </main>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="container mx-auto flex items-center justify-between px-4 py-4 relative z-10">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-none bg-primary text-primary-foreground text-xs font-medium">
          VS
        </div>
        <div className="text-left">
          <p className="text-xs font-medium tracking-tight text-foreground">
            Vanda Studio
          </p>
          <p className="text-[10px] text-muted-foreground">Social media as a service</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
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
                avatarBox: "h-7 w-7 rounded-none",
                userButtonTrigger: "focus:shadow-none focus-visible:outline-none p-0",
                userButtonPopoverCard: "bg-popover rounded-none ring-1 ring-foreground/10",
                userButtonPopoverActionButton: "hover:bg-muted rounded-none",
                userButtonPopoverActionButtonText: "text-foreground text-xs",
                userButtonPopoverFooter: "hidden",
              },
            }}
          />
        </SignedIn>
      </div>
    </header>
  );
}

function Hero() {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className="flex w-full max-w-3xl flex-col items-center space-y-8">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 rounded-none ring-1 ring-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">
        <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} className="size-3" />
        <span className="font-medium">Sala de Conceitos</span>
        <span className="h-1 w-1 rounded-none bg-primary/50" />
        <span className="text-muted-foreground">Beta</span>
      </div>

      {/* Main heading */}
      <div className="space-y-4">
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl md:text-5xl">
          <span className="text-primary">Social media</span>
          <br className="hidden sm:inline" />
          <span className="text-foreground"> as a service.</span>
        </h1>
        <p className="mx-auto max-w-xl text-sm text-muted-foreground md:text-base">
          Digite o @ da sua marca e a Vanda faz uma
          <span className="text-foreground font-medium"> analise completa</span>:
          identifica o que funciona, o que falta e entrega
          <span className="text-foreground font-medium"> ideias de posts prontas </span>
          para voce usar.
        </p>
      </div>

      {/* CTA Section */}
      {!showPrompt ? (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button
            size="lg"
            onClick={() => setShowPrompt(true)}
            className="group"
          >
            <HugeiconsIcon icon={FlashIcon} strokeWidth={2} className="size-4" />
            Analisar meu Instagram
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4 transition-transform group-hover:translate-x-0.5" />
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
      <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] text-muted-foreground pt-2">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-none bg-[var(--success)]" />
          <span>Analise em tempo real</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-none bg-primary" />
          <span>+500 marcas analisadas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-none bg-muted-foreground" />
          <span>Resultados em minutos</span>
        </div>
      </div>
    </div>
  );
}

function PromptPanel() {
  const [handle, setHandle] = useState("");
  const [context, setContext] = useState("");
  const [postType, setPostType] = useState<PostType>("conteudo_profissional");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  const { isSignedIn } = useAuth();
  const generateDemo = useAction(api.demo.generateDemo);

  // Generate fingerprint on mount (client-side only)
  useEffect(() => {
    setFingerprint(generateFingerprint());
  }, []);

  // Check demo usage for anonymous users
  const demoUsage = useQuery(
    api.demoUsage.checkDemoUsage,
    !isSignedIn && fingerprint ? { fingerprint } : "skip"
  );

  const hasUsedDemo = !isSignedIn && demoUsage && !demoUsage.canUse;

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
        postType,
        fingerprint: !isSignedIn ? fingerprint ?? undefined : undefined,
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

  // Show message if user has already used their demo
  if (hasUsedDemo) {
    return (
      <Card className="w-full max-w-xl text-left animate-in fade-in slide-in-from-bottom-4 duration-300">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-none bg-primary/10 flex items-center justify-center">
              <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} className="size-3.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm">Voce ja usou sua demonstracao</CardTitle>
              <CardDescription className="text-xs">
                Crie uma conta gratuita para continuar gerando posts.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Usuarios anonimos tem direito a 1 demonstracao gratuita.
            Crie uma conta para ter acesso a mais recursos e gerar posts ilimitados.
          </p>
          <SignInButton mode="modal">
            <Button size="lg" className="w-full">
              <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} className="size-4" />
              Criar Conta Gratis
            </Button>
          </SignInButton>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-xl text-left animate-in fade-in slide-in-from-bottom-4 duration-300">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-none bg-primary/10 flex items-center justify-center">
            <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} className="size-3.5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm">Qual Instagram vamos analisar?</CardTitle>
            <CardDescription className="text-xs">
              A Vanda analisa sua grade, posts e gera um novo post.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="handle" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
            />
          </div>

          {/* Post type selector */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Tipo de post
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {[
                { value: "promocao" as const, label: "Promocao", icon: MegaphoneIcon, desc: "Vendas e ofertas", disabled: true },
                { value: "conteudo_profissional" as const, label: "Profissional", icon: BriefcaseIcon, desc: "Autoridade e expertise", disabled: false },
                { value: "engajamento" as const, label: "Engajamento", icon: CommentAdd01Icon, desc: "Conexao com audiencia", disabled: true },
              ].map((type) => {
                const buttonContent = (
                  <button
                    type="button"
                    onClick={() => !type.disabled && setPostType(type.value)}
                    disabled={isGenerating || type.disabled}
                    className={cn(
                      "flex items-center gap-2.5 p-2.5 rounded-none ring-1 text-left transition-all w-full",
                      postType === type.value
                        ? "ring-primary bg-primary/5"
                        : "ring-foreground/10 hover:ring-foreground/20 hover:bg-muted/50",
                      (isGenerating || type.disabled) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-none",
                      postType === type.value ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      <HugeiconsIcon icon={type.icon} strokeWidth={2} className="size-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{type.label}</p>
                      <p className="text-[10px] text-muted-foreground">{type.desc}</p>
                    </div>
                  </button>
                );

                if (type.disabled) {
                  return (
                    <Tooltip key={type.value}>
                      <TooltipTrigger asChild>
                        {buttonContent}
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Em progresso...
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return <div key={type.value}>{buttonContent}</div>;
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="context" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Contexto Adicional <span className="text-muted-foreground/60">(opcional)</span>
            </Label>
            <Textarea
              id="context"
              placeholder="Tom desejado, campanhas para destacar, publicos-alvo..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              disabled={isGenerating}
              className="resize-none"
            />
          </div>

          {/* Error display */}
          {error && (
            <div className="p-2.5 rounded-none bg-destructive/10 ring-1 ring-destructive/30 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="pt-1">
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isGenerating || !handle.trim()}
            >
              {isGenerating ? (
                <>
                  <HugeiconsIcon icon={Loading01Icon} strokeWidth={2} className="size-4 animate-spin" />
                  Gerando post...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={FlashIcon} strokeWidth={2} className="size-4" />
                  Gerar Post de Demonstracao
                </>
              )}
            </Button>
            {isGenerating && (
              <p className="text-[10px] text-muted-foreground text-center mt-2">
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
    <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-none bg-primary/10 flex items-center justify-center">
                <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} className="size-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm">Seu Post Gerado</CardTitle>
                <CardDescription className="text-xs">
                  Baseado na analise da sua marca
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onReset}>
              Gerar outro
            </Button>
          </div>
          {result.hasLimitedContext && (
            <div className="mt-3 flex items-start gap-2 p-2.5 rounded-none bg-[var(--warning)]/10 ring-1 ring-[var(--warning)]/30 text-xs">
              <HugeiconsIcon icon={Alert01Icon} strokeWidth={2} className="size-3.5 text-[var(--warning)] mt-0.5 flex-shrink-0" />
              <p className="text-[var(--warning)]">
                Este perfil tem poucos ou nenhum post publicado. A analise foi baseada apenas na bio e informacoes do perfil, o que pode resultar em sugestoes menos precisas.
              </p>
            </div>
          )}
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
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={handleDownload}
                    >
                      <HugeiconsIcon icon={Download01Icon} strokeWidth={2} className="size-3" />
                      Baixar
                    </Button>
                  </div>
                  <div className="absolute top-2 left-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none bg-primary text-primary-foreground text-[10px] font-medium">
                      <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} className="size-2.5" />
                      IA
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <HugeiconsIcon icon={Image01Icon} strokeWidth={2} className="size-8 opacity-30" />
                  <p className="text-xs">Imagem nao disponivel</p>
                </div>
              )}
            </div>

            {/* Caption and Info */}
            <div className="p-4 flex flex-col">
              {/* Caption */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Legenda Gerada
                  </Label>
                  <Button variant="ghost" size="icon-xs" onClick={handleCopy}>
                    {copied ? <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-3" /> : <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-3" />}
                  </Button>
                </div>
                <div className="p-3 rounded-none bg-muted/50 ring-1 ring-foreground/10 mb-3">
                  <p className="whitespace-pre-wrap text-xs leading-relaxed">
                    {result.generatedCaption}
                  </p>
                </div>

                {/* Reasoning */}
                {result.reasoning && (
                  <details className="text-xs text-muted-foreground mb-3">
                    <summary className="cursor-pointer hover:text-foreground transition-colors font-medium">
                      Por que essa legenda?
                    </summary>
                    <p className="mt-2 pl-3 border-l ring-foreground/10">{result.reasoning}</p>
                  </details>
                )}

                {/* Brand Analysis */}
                {result.brandAnalysis && (
                  <div className="space-y-2 pt-3 border-t">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Analise da Marca
                    </p>
                    <div className="space-y-1.5 text-xs">
                      <p>
                        <span className="text-muted-foreground">Voz:</span>{" "}
                        {result.brandAnalysis.brandVoice}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Publico:</span>{" "}
                        {result.brandAnalysis.targetAudience}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {result.brandAnalysis.contentPillars.map((pillar, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-none bg-primary/10 text-primary text-[10px]"
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
                <div className="pt-3 border-t mt-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    Posts Analisados
                  </p>
                  <div className="flex gap-1.5">
                    {result.sourcePosts.slice(0, 3).map((post, i) => (
                      <div key={i} className="w-12 h-12 rounded-none overflow-hidden bg-muted">
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
      <div className="mt-6 text-center">
        <p className="text-xs text-muted-foreground mb-3">
          Gostou? Crie uma conta para gerar posts ilimitados.
        </p>
        <SignedOut>
          <SignInButton mode="modal">
            <Button size="lg">
              <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} className="size-4" />
              Criar Conta Gratis
            </Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <Button size="lg" asChild>
            <a href="/dashboard">
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
              Ir para o Dashboard
            </a>
          </Button>
        </SignedIn>
      </div>
    </div>
  );
}
