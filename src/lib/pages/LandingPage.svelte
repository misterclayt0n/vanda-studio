<script lang="ts">
	import { SignInButton } from "svelte-clerk";
	import Logo from "$lib/components/Logo.svelte";
	import { onMount } from "svelte";

	// Carousel state for stacked cards
	let cardOrder = $state([0, 1, 2]);
	let animatingCard = $state<number | null>(null);
	let isAnimating = $state(false);
	let autoPlayInterval: ReturnType<typeof setInterval> | null = null;

	const cards = [
		{
			image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&h=500&fit=crop&q=80",
			alt: "AI generated abstract art",
			caption: "Explorando novas fronteiras da criatividade digital ✨",
			tags: ["#arte", "#design", "#ai"]
		},
		{
			image: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=500&h=500&fit=crop&q=80",
			alt: "AI generated colorful design",
			caption: "O futuro do conteúdo está aqui 🚀",
			tags: ["#criativo", "#marketing"]
		},
		{
			image: "https://images.unsplash.com/photo-1633177317976-3f9bc45e1d1d?w=500&h=500&fit=crop&q=80",
			alt: "AI generated gradient art",
			caption: "Transformando ideias em realidade visual 💡",
			tags: ["#branding", "#visual", "#inovação"]
		}
	];

	function getCardPosition(cardIndex: number): number {
		return cardOrder.indexOf(cardIndex);
	}

	function bringToFront(cardIndex: number) {
		const currentPosition = getCardPosition(cardIndex);
		if (currentPosition === 0 || isAnimating) return;

		isAnimating = true;
		animatingCard = cardIndex;

		// After the sweep-out animation, reorder and animate to front
		setTimeout(() => {
			const newOrder = cardOrder.filter(i => i !== cardIndex);
			cardOrder = [cardIndex, ...newOrder];

			// Reset animation state after settle
			setTimeout(() => {
				animatingCard = null;
				isAnimating = false;
			}, 400);
		}, 350);
	}

	function cycleToNext() {
		// Bring the back card (position 2) to front
		const backCard = cardOrder[2];
		bringToFront(backCard);
	}

	function startAutoPlay() {
		if (autoPlayInterval) return;
		autoPlayInterval = setInterval(cycleToNext, 3500);
	}

	function stopAutoPlay() {
		if (autoPlayInterval) {
			clearInterval(autoPlayInterval);
			autoPlayInterval = null;
		}
	}

	function handleCardClick(cardIndex: number) {
		stopAutoPlay();
		bringToFront(cardIndex);
		// Restart autoplay after user interaction
		setTimeout(startAutoPlay, 5000);
	}

	onMount(() => {
		startAutoPlay();
		return () => stopAutoPlay();
	});
</script>

<svelte:head>
	<title>Vanda Studio - Geração de Posts com IA</title>
	<meta name="description" content="Crie posts incríveis para Instagram com inteligência artificial. Vanda Studio automatiza sua criação de conteúdo." />
</svelte:head>

<!-- DESIGN 2 REFINED: Bold geometric with design system consistency -->
<div class="min-h-screen bg-background text-foreground overflow-hidden">
	<!-- Navigation - Consistent with app navbar -->
	<nav class="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
		<div class="flex items-center justify-between px-6 lg:px-16 h-14">
			<Logo size="lg" />
			<div class="flex items-center gap-1">
				<a href="#recursos" class="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">Recursos</a>
				<a href="#precos" class="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">Preços</a>
				<SignInButton mode="modal">
					<button class="btn-glow ml-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
						Entrar
					</button>
				</SignInButton>
			</div>
		</div>
	</nav>

	<!-- Hero Section - Bold typography with refined structure -->
	<section class="relative min-h-screen flex items-center pt-14">
		<!-- Geometric accents -->
		<div class="absolute top-32 right-0 w-[40vw] h-[60vh] bg-primary/5 dark:bg-primary/10"></div>
		<div class="absolute bottom-0 left-0 w-[30vw] h-[40vh] border border-border"></div>
		<div class="absolute top-1/2 left-1/4 w-24 h-24 bg-muted transform rotate-45 hidden lg:block"></div>

		<!-- Vertical accent stripe -->
		<div class="absolute left-0 top-14 bottom-0 w-1 bg-primary"></div>

		<div class="relative z-10 px-8 lg:px-16 w-full max-w-[1800px] mx-auto">
			<div class="grid lg:grid-cols-2 gap-16 items-center">
				<!-- Left - Typography -->
				<div class="space-y-8">
					<div class="inline-block border border-border px-4 py-2">
						<span class="text-sm font-medium uppercase tracking-[0.2em] text-primary">Estúdio de Criação</span>
					</div>

					<h1 class="text-5xl sm:text-6xl lg:text-8xl font-serif leading-[0.9] tracking-tight">
						Posts<br/>
						Que<br/>
						<span class="text-primary">Impactam</span>
					</h1>

					<div class="border-l-2 border-primary pl-6">
						<p class="text-lg lg:text-xl text-muted-foreground max-w-md leading-relaxed">
							Geração de imagens. Legendas inteligentes. Agendamento automático.
							<span class="text-foreground font-medium">Tudo com IA.</span>
						</p>
					</div>

					<div class="flex flex-wrap gap-4 pt-4">
						<SignInButton mode="modal">
							<button class="btn-glow group relative bg-primary text-primary-foreground px-8 py-4 text-sm font-medium tracking-wide uppercase overflow-hidden">
								<span class="relative z-10">Começar Agora</span>
								<div class="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12"></div>
							</button>
						</SignInButton>
						<a href="#demo" class="border border-border px-8 py-4 text-sm font-medium tracking-wide uppercase hover:bg-secondary hover:border-primary/50 transition-colors">
							Ver Demo
						</a>
					</div>
				</div>

				<!-- Right - Stacked cards with real posts (carousel) -->
				<div class="relative h-[600px] hidden lg:block card-stack">
					{#each cards as card, cardIndex}
						{@const position = getCardPosition(cardIndex)}
						{@const isSweeping = animatingCard === cardIndex}
						<button
							type="button"
							onclick={() => handleCardClick(cardIndex)}
							class="card-item absolute w-80 border bg-card overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
								{position === 0 ? 'card-front border-primary/50 shadow-md' : ''}
								{position === 1 ? 'card-middle border-border shadow-lg' : ''}
								{position === 2 ? 'card-back border-border shadow-xl' : ''}
								{isSweeping ? 'card-sweep-out' : ''}
							"
							style="--card-index: {position};"
						>
							{#if position === 2 && !isSweeping}
								<div class="absolute -top-3 -left-3 w-6 h-6 bg-primary z-10"></div>
							{:else if position === 1 && !isSweeping}
								<div class="absolute -bottom-3 -right-3 w-6 h-6 bg-foreground z-10"></div>
							{/if}
							<img
								src={card.image}
								alt={card.alt}
								class="w-full aspect-square object-cover"
							/>
							<div class="p-4 space-y-2 text-left">
								<p class="text-sm text-muted-foreground line-clamp-2">{card.caption}</p>
								<div class="flex gap-1.5 flex-wrap">
									{#each card.tags as tag}
										<span class="text-xs text-primary">{tag}</span>
									{/each}
								</div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Decorative number -->
		<div class="absolute bottom-8 right-8 text-[15vw] font-serif text-foreground/[0.02] dark:text-white/[0.03] leading-none pointer-events-none select-none">
			01
		</div>
	</section>
</div>
