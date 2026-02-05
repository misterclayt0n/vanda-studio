<script lang="ts">
	import { SignInButton } from "svelte-clerk";
	import Logo from "$lib/components/Logo.svelte";
	import { onMount } from "svelte";

	let mouseX = $state(0);
	let mouseY = $state(0);

	onMount(() => {
		const handleMouseMove = (e: MouseEvent) => {
			mouseX = e.clientX;
			mouseY = e.clientY;
		};
		window.addEventListener("mousemove", handleMouseMove);
		return () => window.removeEventListener("mousemove", handleMouseMove);
	});
</script>

<svelte:head>
	<title>Vanda Studio - Geração de Posts com IA</title>
	<meta name="description" content="Crie posts incríveis para Instagram com inteligência artificial. Vanda Studio automatiza sua criação de conteúdo." />
</svelte:head>

<!-- DESIGN 2: BRUTALIST GEOMETRIC - Raw, bold shapes with stark contrast and industrial feel -->
<div class="min-h-screen bg-background text-foreground overflow-hidden cursor-none lg:cursor-none">
	<!-- Custom cursor -->
	<div
		class="fixed w-6 h-6 border-2 border-primary pointer-events-none z-[100] hidden lg:block transition-transform duration-75"
		style="left: {mouseX - 12}px; top: {mouseY - 12}px; transform: rotate(45deg);"
	></div>
	<div
		class="fixed w-2 h-2 bg-primary pointer-events-none z-[100] hidden lg:block"
		style="left: {mouseX - 4}px; top: {mouseY - 4}px;"
	></div>


	<!-- Navigation - Brutalist style -->
	<nav class="fixed top-0 left-0 right-0 z-50 border-b-4 border-foreground bg-background">
		<div class="flex items-center justify-between px-6 py-4">
			<Logo size="lg" />
			<div class="flex items-center">
				<a href="#recursos" class="px-6 py-2 text-sm font-bold uppercase tracking-widest border-l-4 border-foreground hover:bg-foreground hover:text-background transition-colors">Recursos</a>
				<a href="#precos" class="px-6 py-2 text-sm font-bold uppercase tracking-widest border-l-4 border-foreground hover:bg-foreground hover:text-background transition-colors">Preços</a>
				<SignInButton mode="modal">
					<button class="px-6 py-2 text-sm font-bold uppercase tracking-widest border-l-4 border-foreground bg-primary text-primary-foreground hover:bg-foreground hover:text-background transition-colors">
						Entrar →
					</button>
				</SignInButton>
			</div>
		</div>
	</nav>

	<!-- Hero Section - Brutalist typography -->
	<section class="relative min-h-screen flex items-center pt-24">
		<!-- Large geometric shapes -->
		<div class="absolute top-32 right-0 w-[40vw] h-[60vh] bg-primary/10 dark:bg-primary/20"></div>
		<div class="absolute bottom-0 left-0 w-[30vw] h-[40vh] border-4 border-foreground/10"></div>
		<div class="absolute top-1/2 left-1/4 w-32 h-32 bg-foreground/5 transform rotate-45"></div>

		<!-- Vertical stripe accent -->
		<div class="absolute left-0 top-24 bottom-0 w-4 bg-primary"></div>

		<div class="relative z-10 px-8 lg:px-16 w-full max-w-[1800px] mx-auto">
			<div class="grid lg:grid-cols-2 gap-16 items-center">
				<!-- Left - Typography heavy -->
				<div class="space-y-8">
					<div class="inline-block border-4 border-foreground px-4 py-2">
						<span class="text-sm font-bold uppercase tracking-[0.3em]">Estúdio IA</span>
					</div>

					<h1 class="text-6xl sm:text-7xl lg:text-[8rem] font-bold leading-[0.85] tracking-tighter uppercase">
						<span class="block">Posts</span>
						<span class="block text-primary">Que</span>
						<span class="block">Impactam</span>
					</h1>

					<div class="flex items-start gap-4 border-l-4 border-primary pl-6">
						<p class="text-lg lg:text-xl text-muted-foreground max-w-md font-medium">
							Geração de imagens. Legendas inteligentes. Agendamento automático.
							<span class="text-foreground font-bold">Tudo com IA.</span>
						</p>
					</div>

					<div class="flex flex-wrap gap-4 pt-8">
						<SignInButton mode="modal">
							<button class="group relative bg-foreground text-background px-10 py-5 text-sm font-bold uppercase tracking-widest overflow-hidden">
								<span class="relative z-10">Começar Agora</span>
								<div class="absolute top-0 left-0 w-full h-full bg-primary transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
								<span class="absolute top-0 left-0 w-full h-full flex items-center justify-center text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-bold">Começar Agora</span>
							</button>
						</SignInButton>
						<a href="#demo" class="border-4 border-foreground px-10 py-5 text-sm font-bold uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors">
							Demo
						</a>
					</div>
				</div>

				<!-- Right - Stacked cards brutalist -->
				<div class="relative h-[500px] hidden lg:block">
					<!-- Card stack -->
					<div class="absolute top-0 right-0 w-72 h-96 border-4 border-foreground bg-card transform translate-x-8 translate-y-8 hover:translate-x-4 hover:translate-y-4 transition-transform">
						<div class="absolute -top-4 -left-4 w-8 h-8 bg-primary"></div>
						<div class="h-2/3 bg-gradient-to-br from-primary/30 to-transparent"></div>
						<div class="p-6 space-y-3">
							<div class="h-3 w-full bg-foreground/20"></div>
							<div class="h-3 w-3/4 bg-foreground/20"></div>
							<div class="h-3 w-1/2 bg-foreground/20"></div>
						</div>
					</div>

					<div class="absolute top-16 right-16 w-72 h-96 border-4 border-foreground bg-card transform hover:translate-x-2 hover:translate-y-2 transition-transform">
						<div class="absolute -bottom-4 -right-4 w-8 h-8 bg-foreground"></div>
						<div class="h-2/3 bg-gradient-to-tr from-primary/40 to-primary/10"></div>
						<div class="p-6 space-y-3">
							<div class="h-3 w-full bg-foreground/20"></div>
							<div class="h-3 w-2/3 bg-foreground/20"></div>
						</div>
					</div>

					<div class="absolute top-32 right-32 w-72 h-96 border-4 border-primary bg-card">
						<div class="h-2/3 bg-gradient-to-bl from-primary/50 to-primary/20"></div>
						<div class="p-6 space-y-3">
							<div class="h-3 w-full bg-foreground/20"></div>
							<div class="h-3 w-4/5 bg-foreground/20"></div>
							<div class="h-3 w-1/2 bg-foreground/20"></div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Large number decoration -->
		<div class="absolute bottom-8 right-8 text-[20vw] font-bold text-foreground/[0.02] dark:text-white/[0.02] leading-none pointer-events-none">
			01
		</div>
	</section>

	<!-- Features Section - Grid brutalist -->
	<section id="recursos" class="py-24 lg:py-32 border-t-4 border-foreground">
		<div class="max-w-[1800px] mx-auto px-8 lg:px-16">
			<!-- Section header -->
			<div class="flex items-end justify-between mb-16 border-b-4 border-foreground pb-8">
				<div>
					<span class="text-sm font-bold uppercase tracking-[0.3em] text-primary">02 / Recursos</span>
					<h2 class="text-4xl lg:text-6xl font-bold uppercase tracking-tight mt-4">
						O Que Você<br/>Pode Fazer
					</h2>
				</div>
				<div class="hidden lg:block text-right">
					<span class="text-7xl font-bold text-foreground/10">★</span>
				</div>
			</div>

			<!-- Features in stark grid -->
			<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-0">
				<div class="border-4 border-foreground p-8 lg:p-12 group hover:bg-foreground hover:text-background transition-colors -ml-0 md:-ml-[4px] -mt-0 md:-mt-[4px]">
					<div class="text-6xl font-bold text-primary group-hover:text-background mb-6">01</div>
					<h3 class="text-2xl font-bold uppercase tracking-tight mb-4">Imagens IA</h3>
					<p class="text-muted-foreground group-hover:text-background/70 leading-relaxed">
						Gere visuais únicos com modelos de última geração. Controle estilo, composição e formato.
					</p>
				</div>

				<div class="border-4 border-foreground p-8 lg:p-12 group hover:bg-primary hover:text-primary-foreground transition-colors -ml-0 md:-ml-[4px] -mt-[4px]">
					<div class="text-6xl font-bold text-primary group-hover:text-primary-foreground mb-6">02</div>
					<h3 class="text-2xl font-bold uppercase tracking-tight mb-4">Legendas</h3>
					<p class="text-muted-foreground group-hover:text-primary-foreground/80 leading-relaxed">
						IA que entende seu contexto. Gere textos envolventes com hashtags otimizadas.
					</p>
				</div>

				<div class="border-4 border-foreground p-8 lg:p-12 group hover:bg-foreground hover:text-background transition-colors -ml-0 lg:-ml-[4px] -mt-[4px]">
					<div class="text-6xl font-bold text-primary group-hover:text-background mb-6">03</div>
					<h3 class="text-2xl font-bold uppercase tracking-tight mb-4">Calendário</h3>
					<p class="text-muted-foreground group-hover:text-background/70 leading-relaxed">
						Integre com Google Calendar. Agende posts e mantenha consistência.
					</p>
				</div>

				<div class="border-4 border-foreground p-8 lg:p-12 group hover:bg-primary hover:text-primary-foreground transition-colors -ml-0 md:-ml-[4px] -mt-[4px]">
					<div class="text-6xl font-bold text-primary group-hover:text-primary-foreground mb-6">04</div>
					<h3 class="text-2xl font-bold uppercase tracking-tight mb-4">Projetos</h3>
					<p class="text-muted-foreground group-hover:text-primary-foreground/80 leading-relaxed">
						Organize múltiplas contas. Cada projeto com sua identidade visual única.
					</p>
				</div>

				<div class="border-4 border-foreground p-8 lg:p-12 group hover:bg-foreground hover:text-background transition-colors -ml-0 md:-ml-[4px] -mt-[4px]">
					<div class="text-6xl font-bold text-primary group-hover:text-background mb-6">05</div>
					<h3 class="text-2xl font-bold uppercase tracking-tight mb-4">Galeria</h3>
					<p class="text-muted-foreground group-hover:text-background/70 leading-relaxed">
						Visualize todos seus posts gerados. Busca avançada e filtros inteligentes.
					</p>
				</div>

				<div class="border-4 border-primary bg-primary text-primary-foreground p-8 lg:p-12 -ml-0 lg:-ml-[4px] -mt-[4px]">
					<div class="text-6xl font-bold mb-6">→</div>
					<h3 class="text-2xl font-bold uppercase tracking-tight mb-4">Comece Agora</h3>
					<SignInButton mode="modal">
						<button class="mt-4 border-4 border-primary-foreground px-6 py-3 font-bold uppercase tracking-widest hover:bg-primary-foreground hover:text-primary transition-colors">
							Criar Conta
						</button>
					</SignInButton>
				</div>
			</div>
		</div>
	</section>

	<!-- Stats Section -->
	<section class="py-24 border-t-4 border-foreground bg-foreground text-background">
		<div class="max-w-[1800px] mx-auto px-8 lg:px-16">
			<div class="grid md:grid-cols-3 gap-8 lg:gap-16">
				<div class="text-center lg:text-left">
					<div class="text-6xl lg:text-8xl font-bold text-primary">5K+</div>
					<p class="text-lg font-medium uppercase tracking-widest mt-4 text-background/70">Criadores Ativos</p>
				</div>
				<div class="text-center">
					<div class="text-6xl lg:text-8xl font-bold text-primary">100K+</div>
					<p class="text-lg font-medium uppercase tracking-widest mt-4 text-background/70">Posts Gerados</p>
				</div>
				<div class="text-center lg:text-right">
					<div class="text-6xl lg:text-8xl font-bold text-primary">99%</div>
					<p class="text-lg font-medium uppercase tracking-widest mt-4 text-background/70">Satisfação</p>
				</div>
			</div>
		</div>
	</section>

	<!-- CTA Section -->
	<section class="py-24 lg:py-32 border-t-4 border-foreground relative">
		<div class="absolute top-0 left-0 w-1/2 h-full bg-primary/5"></div>

		<div class="relative max-w-[1800px] mx-auto px-8 lg:px-16">
			<div class="grid lg:grid-cols-2 gap-16 items-center">
				<div>
					<span class="text-sm font-bold uppercase tracking-[0.3em] text-primary">03 / Começar</span>
					<h2 class="text-4xl lg:text-6xl font-bold uppercase tracking-tight mt-4">
						Pronto Para<br/>
						<span class="text-primary">Transformar</span><br/>
						Seu Conteúdo?
					</h2>
				</div>
				<div class="flex flex-col items-start gap-6">
					<p class="text-xl text-muted-foreground">
						Junte-se a milhares de criadores. Comece gratuitamente, escale quando precisar.
					</p>
					<SignInButton mode="modal">
						<button class="group relative border-4 border-foreground px-12 py-6 text-lg font-bold uppercase tracking-widest overflow-hidden">
							<span class="relative z-10 group-hover:text-background transition-colors">Começar Gratuitamente</span>
							<div class="absolute inset-0 bg-foreground transform origin-bottom scale-y-0 group-hover:scale-y-100 transition-transform duration-300"></div>
						</button>
					</SignInButton>
				</div>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="border-t-4 border-foreground py-8">
		<div class="max-w-[1800px] mx-auto px-8 lg:px-16 flex flex-col lg:flex-row items-center justify-between gap-6">
			<Logo size="sm" />
			<p class="text-sm font-medium uppercase tracking-widest text-muted-foreground">
				© 2025 Vanda Studio
			</p>
			<div class="flex items-center gap-6">
				<a href="/privacidade" class="text-sm font-bold uppercase tracking-widest hover:text-primary transition-colors">Privacidade</a>
				<a href="/termos" class="text-sm font-bold uppercase tracking-widest hover:text-primary transition-colors">Termos</a>
			</div>
		</div>
	</footer>
</div>

<style>
	@media (min-width: 1024px) {
		:global(body) {
			cursor: none !important;
		}
		:global(a), :global(button) {
			cursor: none !important;
		}
	}
</style>
