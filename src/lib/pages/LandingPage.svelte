<script lang="ts">
	import Logo from "$lib/components/Logo.svelte";
	import LandingAppPreview from "$lib/components/LandingAppPreview.svelte";
	import LandingThemeToggle from "$lib/components/LandingThemeToggle.svelte";

	const appUrl = "/library";
</script>

<svelte:head>
	<title>Vanda Studio — SOCIAL MEDIA AS A SERVICE e criação com IA</title>
	<meta
		name="description"
		content="Mídia, posts e redes no mesmo fluxo. Da PME à corporação — com IA."
	/>
</svelte:head>

<div class="min-h-screen bg-background text-foreground overflow-hidden ambient-glow ambient-noise">
	<nav class="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
		<div class="flex items-center justify-between px-6 lg:px-16 h-14">
			<a href="/" class="hover:opacity-90 transition-opacity" aria-label="Vanda Studio — início">
				<Logo size="lg" />
			</a>
			<div class="hidden md:flex items-center gap-1">
				<a href="#solucao" class="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">Solução</a>
				<a href="#recursos" class="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">Recursos</a>
				<a href="#precos" class="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">Preços</a>
			</div>
			<div class="flex items-center gap-2 sm:gap-3">
				<LandingThemeToggle />
				<a
					href={appUrl}
					class="btn-glow px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
				>
					Ir para o app
				</a>
			</div>
		</div>
		<div class="flex md:hidden gap-1 overflow-x-auto border-t border-border px-4 py-2.5 bg-background/90 backdrop-blur-md [scrollbar-width:none]">
			<a href="#solucao" class="shrink-0 px-3 py-1 text-xs font-medium text-muted-foreground">Solução</a>
			<a href="#recursos" class="shrink-0 px-3 py-1 text-xs font-medium text-muted-foreground">Recursos</a>
			<a href="#precos" class="shrink-0 px-3 py-1 text-xs font-medium text-muted-foreground">Preços</a>
		</div>
	</nav>

	<section class="relative min-h-[90vh] flex items-center pt-24 md:pt-14">
		<div class="absolute top-28 right-0 w-[42vw] max-h-[70vh] h-[60vh] bg-primary/5 dark:bg-primary/10"></div>
		<div class="absolute bottom-0 left-0 w-[32vw] h-[42vh] border border-border/80"></div>
		<div class="absolute top-1/2 left-1/4 w-24 h-24 bg-muted/80 transform rotate-45 hidden lg:block"></div>
		<div class="absolute left-0 top-24 md:top-14 bottom-0 w-1 bg-primary"></div>

		<div class="relative z-10 px-8 lg:px-16 w-full max-w-[1800px] mx-auto">
			<div class="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
				<div class="space-y-8">
					<div class="inline-block border border-border px-4 py-2 bg-background/60">
						<span class="text-sm font-medium uppercase tracking-[0.2em] text-primary">SOCIAL MEDIA AS A SERVICE</span>
					</div>

					<h1 class="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-serif leading-[0.92] tracking-tight">
						Sua marca<br />
						nas redes,<br />
						<span class="text-primary">sem o caos.</span>
					</h1>

					<p class="text-lg lg:text-xl text-muted-foreground max-w-lg leading-relaxed border-l-2 border-primary pl-6">
						<strong class="text-foreground font-medium">SOCIAL MEDIA AS A SERVICE</strong> — mídia, legendas e calendário num fluxo só. Menos ferramentas, mais consistência.
					</p>

					<div class="flex flex-wrap gap-4 pt-2">
						<a
							href={appUrl}
							class="btn-glow group relative bg-primary text-primary-foreground px-8 py-4 text-sm font-medium tracking-wide uppercase overflow-hidden"
						>
							<span class="relative z-10">Começar agora</span>
							<div class="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12"></div>
						</a>
						<a
							href="#precos"
							class="border border-border px-8 py-4 text-sm font-medium tracking-wide uppercase hover:bg-secondary hover:border-primary/50 transition-colors"
						>
							Ver planos
						</a>
					</div>
				</div>

				<div class="hidden lg:flex lg:items-center lg:justify-end w-full min-h-[360px]">
					<LandingAppPreview />
				</div>
			</div>
		</div>

		<div class="absolute bottom-8 right-8 text-[min(15vw,12rem)] font-serif text-foreground/[0.04] dark:text-white/[0.05] leading-none pointer-events-none select-none">
			01
		</div>
	</section>

	<section id="solucao" class="py-16 lg:py-24 border-t border-border">
		<div class="max-w-[1800px] mx-auto px-8 lg:px-16">
			<div class="mb-12 max-w-2xl">
				<span class="text-sm font-medium uppercase tracking-[0.2em] text-primary">Por que a Vanda</span>
				<h2 class="text-3xl sm:text-4xl lg:text-5xl font-serif mt-4 leading-tight">
					Um lugar para criar, organizar e publicar.
				</h2>
			</div>
			<div class="grid md:grid-cols-3 gap-px bg-border">
				<div class="bg-background p-8 lg:p-10">
					<h3 class="text-lg font-serif mb-2 text-primary">Para quem</h3>
					<p class="text-muted-foreground leading-relaxed text-sm">
						PME, marketing ou operação grande — quem precisa de escala sem perder o padrão visual.
					</p>
				</div>
				<div class="bg-background p-8 lg:p-10">
					<h3 class="text-lg font-serif mb-2 text-primary">O que muda</h3>
					<p class="text-muted-foreground leading-relaxed text-sm">
						Acaba o salto entre banco de imagem, editor e feed. Tudo integrado.
					</p>
				</div>
				<div class="bg-background p-8 lg:p-10">
					<h3 class="text-lg font-serif mb-2 text-primary">Diferencial</h3>
					<p class="text-muted-foreground leading-relaxed text-sm">
						UX pensada para produção diária — mídia e posts no mesmo fluxo.
					</p>
				</div>
			</div>
		</div>
	</section>

	<section id="recursos" class="py-16 lg:py-24 border-t border-border bg-card/40">
		<div class="max-w-[1800px] mx-auto px-8 lg:px-16">
			<div class="mb-12 pb-8 border-b border-border">
				<span class="text-sm font-medium uppercase tracking-[0.2em] text-primary">Recursos</span>
				<h2 class="text-3xl sm:text-4xl lg:text-5xl font-serif mt-4 leading-tight">O essencial para executar</h2>
			</div>

			<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
				<div class="bg-background p-6 lg:p-8">
					<h3 class="text-lg font-serif text-foreground">Imagens com IA</h3>
					<p class="text-sm text-muted-foreground mt-1">Modelos e formatos sob controle.</p>
				</div>
				<div class="bg-background p-6 lg:p-8">
					<h3 class="text-lg font-serif text-foreground">Legendas inteligentes</h3>
					<p class="text-sm text-muted-foreground mt-1">Texto e hashtags no contexto da marca.</p>
				</div>
				<div class="bg-background p-6 lg:p-8">
					<h3 class="text-lg font-serif text-foreground">Agenda</h3>
					<p class="text-sm text-muted-foreground mt-1">Calendário e lembretes alinhados.</p>
				</div>
				<div class="bg-background p-6 lg:p-8">
					<h3 class="text-lg font-serif text-foreground">Multi-projetos</h3>
					<p class="text-sm text-muted-foreground mt-1">Várias frentes, identidades separadas.</p>
				</div>
				<div class="bg-background p-6 lg:p-8">
					<h3 class="text-lg font-serif text-foreground">Galeria</h3>
					<p class="text-sm text-muted-foreground mt-1">Histórico pesquisável do que já criou.</p>
				</div>
				<div class="bg-primary text-primary-foreground p-6 lg:p-8 flex flex-col justify-between min-h-[140px]">
					<h3 class="text-lg font-serif">Ver no app</h3>
					<a
						href={appUrl}
						class="inline-block self-start border border-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-foreground hover:text-primary transition-colors mt-4"
					>
						Abrir Vanda
					</a>
				</div>
			</div>
		</div>
	</section>

	<section id="precos" class="py-16 lg:py-24 border-t border-border scroll-mt-20">
		<div class="max-w-[1800px] mx-auto px-8 lg:px-16">
			<div class="mb-12 pb-8 border-b border-border">
				<span class="text-sm font-medium uppercase tracking-[0.2em] text-primary">Preços</span>
				<h2 class="text-3xl sm:text-4xl lg:text-5xl font-serif mt-4 leading-tight">Mesmos valores da conta</h2>
				<p class="text-muted-foreground mt-3 text-sm max-w-md">Assinatura e cobrança em <span class="text-foreground">Conta → Planos</span>.</p>
			</div>

			<div class="grid gap-6 lg:gap-8 md:grid-cols-3">
				<div class="relative flex flex-col border-2 border-primary bg-card p-8 lg:p-10 shadow-sm">
					<div class="absolute -top-3 left-1/2 -translate-x-1/2">
						<span class="inline-block bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 uppercase tracking-wide">Mais popular</span>
					</div>
					<div class="mb-4">
						<h3 class="font-serif text-2xl font-semibold">Básico</h3>
						<p class="text-xs text-muted-foreground mt-1">Rotina consistente, fluxos essenciais.</p>
					</div>
					<div class="mb-2">
						<span class="text-4xl font-bold">R$&nbsp;87</span>
						<span class="text-muted-foreground">/mês</span>
					</div>
					<div class="mb-5 flex items-center gap-2 border border-green-600/25 bg-green-600/10 px-3 py-2 text-xs font-semibold text-green-700 dark:text-green-500">
						<span aria-hidden="true">⏱</span>
						1 semana grátis
					</div>
					<ul class="mb-8 flex-1 space-y-2 text-sm text-muted-foreground">
						<li class="flex gap-2"><span class="text-green-600 shrink-0" aria-hidden="true">✓</span> Uso recorrente individual</li>
						<li class="flex gap-2"><span class="text-green-600 shrink-0" aria-hidden="true">✓</span> Imagens, legendas e modelos</li>
						<li class="flex gap-2"><span class="text-green-600 shrink-0" aria-hidden="true">✓</span> Suporte por email</li>
					</ul>
					<a
						href="/account#planos"
						class="btn-glow w-full text-center bg-primary text-primary-foreground py-3 text-sm font-medium hover:bg-primary/90 transition-colors"
					>
						Assinar Básico
					</a>
				</div>

				<div class="relative flex flex-col border border-border bg-card p-8 lg:p-10">
					<div class="mb-4">
						<h3 class="font-serif text-2xl font-semibold">Mediano</h3>
						<p class="text-xs text-muted-foreground mt-1">Mais volume e iteração no mês.</p>
					</div>
					<div class="mb-6">
						<span class="text-4xl font-bold">R$&nbsp;149</span>
						<span class="text-muted-foreground">/mês</span>
					</div>
					<ul class="mb-8 flex-1 space-y-2 text-sm text-muted-foreground">
						<li class="flex gap-2"><span class="text-green-600 shrink-0" aria-hidden="true">✓</span> Faixa ampliada para produção</li>
						<li class="flex gap-2"><span class="text-green-600 shrink-0" aria-hidden="true">✓</span> Todos os modelos e estilos</li>
						<li class="flex gap-2"><span class="text-green-600 shrink-0" aria-hidden="true">✓</span> Suporte prioritário</li>
					</ul>
					<a
						href="/account#planos"
						class="w-full text-center border border-border py-3 text-sm font-medium hover:bg-secondary hover:border-primary/40 transition-colors"
					>
						Assinar Mediano
					</a>
				</div>

				<div class="relative flex flex-col border border-border bg-card p-8 lg:p-10">
					<div class="mb-4">
						<h3 class="font-serif text-2xl font-semibold">Profissional</h3>
						<p class="text-xs text-muted-foreground mt-1">Times e campanhas em escala.</p>
					</div>
					<div class="mb-6">
						<span class="text-4xl font-bold">R$&nbsp;249</span>
						<span class="text-muted-foreground">/mês</span>
					</div>
					<ul class="mb-8 flex-1 space-y-2 text-sm text-muted-foreground">
						<li class="flex gap-2"><span class="text-green-600 shrink-0" aria-hidden="true">✓</span> Maior capacidade mensal</li>
						<li class="flex gap-2"><span class="text-green-600 shrink-0" aria-hidden="true">✓</span> Tudo do Mediano + consultoria</li>
						<li class="flex gap-2"><span class="text-green-600 shrink-0" aria-hidden="true">✓</span> Suporte prioritário</li>
					</ul>
					<a
						href="/account#planos"
						class="w-full text-center border border-border py-3 text-sm font-medium hover:bg-secondary hover:border-primary/40 transition-colors"
					>
						Assinar Profissional
					</a>
				</div>
			</div>
		</div>
	</section>

	<section class="py-16 lg:py-24 border-t border-border relative">
		<div class="absolute top-0 left-0 w-1/2 h-full bg-primary/5 dark:bg-primary/10"></div>
		<div class="relative max-w-[1800px] mx-auto px-8 lg:px-16 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-8">
			<h2 class="text-3xl lg:text-4xl font-serif leading-tight">
				Pronto para <span class="text-primary">começar?</span>
			</h2>
			<div class="flex flex-wrap gap-4">
				<a
					href={appUrl}
					class="btn-glow group relative bg-primary text-primary-foreground px-8 py-4 text-sm font-medium tracking-wide uppercase overflow-hidden"
				>
					<span class="relative z-10">Ir para o app</span>
					<div class="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12"></div>
				</a>
				<a
					href="/account#planos"
					class="border border-border px-8 py-4 text-sm font-medium tracking-wide uppercase hover:bg-secondary transition-colors"
				>
					Planos na conta
				</a>
			</div>
		</div>
	</section>

	<footer class="border-t border-border py-12">
		<div class="max-w-[1800px] mx-auto px-8 lg:px-16 flex flex-col lg:flex-row items-center justify-between gap-6">
			<Logo size="sm" />
			<p class="text-sm text-muted-foreground">
				© 2026 Vanda Studio. Todos os direitos reservados.
			</p>
		</div>
	</footer>
</div>
