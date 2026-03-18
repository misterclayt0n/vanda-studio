<script lang="ts">
	import { goto } from "$app/navigation";
	import { SignInButton } from "svelte-clerk";
	import { Button } from "$lib/components/ui";
	import type { ImageGenerationUiError } from "$lib/studio/imageGenerationErrors";

	interface Props {
		error: ImageGenerationUiError | null;
		onclose: () => void;
	}

	let { error, onclose }: Props = $props();

	const isOpen = $derived(!!error && error.surface === "modal");
	const primaryLabel = $derived(
		error?.action === "sign_in"
			? "Entrar"
			: "Ver planos"
	);

	function handlePlansClick() {
		onclose();
		goto("/account#planos");
	}
</script>

{#if isOpen && error}
	<div
		class="fixed inset-0 z-50 bg-black/70 backdrop-blur-md"
		onclick={onclose}
		onkeydown={(event) => event.key === "Enter" && onclose()}
		role="button"
		tabindex="0"
	></div>

	<div class="fixed inset-4 z-50 flex items-center justify-center p-4">
		<div class="w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/10 bg-[#121114] text-white shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
			<div class="flex items-start justify-between gap-6 border-b border-white/10 px-8 py-7">
				<div class="flex items-start gap-5">
					<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] border border-primary/20 bg-primary/10 text-primary">
						<svg class="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 0h10.5a1.5 1.5 0 011.5 1.5v6.75a1.5 1.5 0 01-1.5 1.5H6.75a1.5 1.5 0 01-1.5-1.5V12a1.5 1.5 0 011.5-1.5z"
							/>
						</svg>
					</div>
					<div class="space-y-2">
						<p class="text-xs font-medium uppercase tracking-[0.24em] text-primary/80">
							Geração de imagens
						</p>
						<h2 class="max-w-xl text-3xl font-semibold leading-tight md:text-[2.2rem]">
							{error.title}
						</h2>
						<p class="max-w-2xl text-base leading-7 text-white/70">
							{error.message}
						</p>
					</div>
				</div>

				<button
					type="button"
					aria-label="Fechar"
					class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70 transition-colors hover:border-white/25 hover:text-white"
					onclick={onclose}
				>
					<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.7" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="flex flex-col justify-between gap-8 px-8 py-7 md:flex-row md:items-end">
				<div class="space-y-3 text-sm text-white/60">
					<p>Você pode voltar para ajustar o prompt ou resolver isso agora.</p>
					<div class="flex flex-wrap gap-2">
						<span class="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.14em] text-white/50">
							{error.code === "PLAN_REQUIRED" ? "Plano" : error.code === "CREDITS_EXHAUSTED" ? "Créditos" : "Conta"}
						</span>
					</div>
				</div>

				<div class="flex flex-col gap-3 sm:flex-row">
					<Button variant="outline" class="min-w-40 border-white/15 bg-white/5 text-white hover:bg-white/10" onclick={onclose}>
						Agora não
					</Button>

					{#if error.action === "sign_in"}
						<SignInButton mode="modal">
							<Button class="min-w-44" onclick={onclose}>
								{primaryLabel}
							</Button>
						</SignInButton>
					{:else}
						<Button class="min-w-44" onclick={handlePlansClick}>
							{primaryLabel}
						</Button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
