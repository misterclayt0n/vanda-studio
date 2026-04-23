<script lang="ts">
	import Logo from "$lib/components/Logo.svelte";

	type Section = {
		title: string;
		paragraphs?: string[];
		items?: string[];
	};

	interface Props {
		title: string;
		description: string;
		updatedAt: string;
		sections: Section[];
	}

	let { title, description, updatedAt, sections }: Props = $props();
</script>

<svelte:head>
	<title>{title} | Vanda Studio</title>
	<meta name="description" content={description} />
</svelte:head>

<main class="min-h-screen bg-background text-foreground">
	<div class="mx-auto flex w-full max-w-4xl flex-col px-6 py-10 sm:px-8 sm:py-14">
		<a href="/" class="mb-12 inline-flex w-fit items-center text-foreground">
			<Logo size="md" />
		</a>

		<header class="border-b border-border pb-8">
			<p class="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
				Jurídico
			</p>
			<h1 class="text-4xl font-semibold leading-tight sm:text-5xl">{title}</h1>
			<p class="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p>
			<p class="mt-6 text-sm text-muted-foreground">Última atualização: {updatedAt}</p>
		</header>

		<div class="divide-y divide-border">
			{#each sections as section}
				<section class="py-8">
					<h2 class="text-2xl font-semibold leading-tight">{section.title}</h2>
					{#if section.paragraphs}
						<div class="mt-4 space-y-4 text-base leading-7 text-muted-foreground">
							{#each section.paragraphs as paragraph}
								<p>{paragraph}</p>
							{/each}
						</div>
					{/if}
					{#if section.items}
						<ul class="mt-4 list-disc space-y-3 pl-5 text-base leading-7 text-muted-foreground">
							{#each section.items as item}
								<li>{item}</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
		</div>
	</div>
</main>
