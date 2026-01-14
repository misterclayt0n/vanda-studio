<script lang="ts">
	import { Button, Textarea, Label, Badge, Separator, Input } from "$lib/components/ui";
	import { SignedIn, SignedOut, SignInButton, UserButton } from "svelte-clerk";

	// Mock state for UI demonstration
	let prompt = $state("");
	let tone = $state("professional");
	let customTone = $state("");
	let useCustomTone = $state(false);
	let platform = $state("instagram");
	let isGenerating = $state(false);
	let hasGenerated = $state(false);

	// Mock generated content
	const mockCaption = `Elevate your morning routine with intention and purpose.

Every successful day begins with a moment of clarity. Take time to breathe, reflect, and set your goals before the world demands your attention.

What's your non-negotiable morning ritual?

#MorningRoutine #Productivity #Mindfulness #SuccessMindset #DailyHabits`;

	const mockImageUrl = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=800&fit=crop";

	// Mock generation function
	function handleGenerate() {
		isGenerating = true;
		// Simulate API delay
		setTimeout(() => {
			isGenerating = false;
			hasGenerated = true;
		}, 2000);
	}

	function handleRegenerate() {
		isGenerating = true;
		setTimeout(() => {
			isGenerating = false;
		}, 1500);
	}

	function handleCopyCaption() {
		navigator.clipboard.writeText(mockCaption);
	}
</script>

<svelte:head>
	<title>Create Post - Vanda Studio</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
	<!-- Header -->
	<header class="shrink-0 border-b border-border">
		<div class="flex h-14 items-center justify-between px-4">
			<div class="flex items-center gap-4">
				<a href="/" class="flex items-center gap-2">
					<h1 class="text-lg font-semibold">Vanda Studio</h1>
				</a>
				<Separator orientation="vertical" class="h-6" />
				<span class="text-sm text-muted-foreground">Create Post</span>
			</div>

			<div class="flex items-center gap-4">
				<SignedOut>
					<SignInButton mode="modal">
						<button
							class="h-8 rounded-none border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
						>
							Sign In
						</button>
					</SignInButton>
				</SignedOut>
				<SignedIn>
					<UserButton />
				</SignedIn>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<div class="flex min-h-0 flex-1">
		<!-- Left Panel - Prompt Configuration -->
		<aside class="flex w-[400px] shrink-0 flex-col border-r border-border bg-sidebar">
			<div class="flex-1 overflow-y-auto p-6">
				<div class="space-y-6">
					<!-- Section: Prompt -->
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<Label class="text-sm font-medium">Prompt</Label>
							<Badge variant="secondary">Required</Badge>
						</div>
						<Textarea
							bind:value={prompt}
							placeholder="Describe the post you want to create. Be specific about the topic, message, and any key points you want to include..."
							class="min-h-[140px] resize-none bg-background"
						/>
					</div>

					<Separator />

					<!-- Section: Tone -->
					<div class="space-y-3">
						<Label class="text-sm font-medium">Tone</Label>
						<div class="grid grid-cols-2 gap-2">
							{#each ["professional", "casual", "inspiring", "humorous", "educational", "promotional"] as toneOption}
								<button
									class="h-9 rounded-none border px-3 text-sm transition-colors {!useCustomTone && tone === toneOption 
										? 'border-primary bg-primary/10 text-primary' 
										: 'border-border bg-background hover:bg-muted'}"
									onclick={() => { tone = toneOption; useCustomTone = false; }}
								>
									{toneOption.charAt(0).toUpperCase() + toneOption.slice(1)}
								</button>
							{/each}
						</div>
						<div class="relative">
							<Input
								type="text"
								bind:value={customTone}
								placeholder="Or describe your own tone..."
								class="bg-background {useCustomTone ? 'border-primary ring-1 ring-primary' : ''}"
								onfocus={() => useCustomTone = true}
							/>
						</div>
					</div>

					<Separator />

					<!-- Section: Platform -->
					<div class="space-y-3">
						<Label class="text-sm font-medium">Platform</Label>
						<div class="grid grid-cols-3 gap-2">
							{#each [
								{ id: "instagram", label: "Instagram", enabled: true },
								{ id: "twitter", label: "Twitter/X", enabled: false },
								{ id: "linkedin", label: "LinkedIn", enabled: false }
							] as platformOption}
								<button
									class="h-9 rounded-none border px-3 text-sm transition-colors {platform === platformOption.id 
										? 'border-primary bg-primary/10 text-primary' 
										: platformOption.enabled 
											? 'border-border bg-background hover:bg-muted'
											: 'border-border bg-muted/50 text-muted-foreground cursor-not-allowed'}"
									onclick={() => platformOption.enabled && (platform = platformOption.id)}
									disabled={!platformOption.enabled}
								>
									{platformOption.label}
								</button>
							{/each}
						</div>
					</div>

					<Separator />

					<!-- Section: Additional Context -->
					<div class="space-y-3">
						<Label class="text-sm font-medium">Additional Context</Label>
						<Input
							type="text"
							placeholder="Brand name, product, campaign..."
							class="bg-background"
						/>
					</div>

				</div>
			</div>

			<!-- Generate Button -->
			<div class="shrink-0 border-t border-border bg-sidebar p-4">
				<Button
					class="w-full"
					disabled={!prompt.trim() || isGenerating}
					onclick={handleGenerate}
				>
					{#if isGenerating}
						<svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Generating...
					{:else}
						Generate Post
					{/if}
				</Button>
			</div>
		</aside>

		<!-- Right Panel - Preview -->
		<main class="flex flex-1 flex-col overflow-hidden bg-muted/30">
			{#if !hasGenerated && !isGenerating}
				<!-- Empty State -->
				<div class="flex flex-1 flex-col items-center justify-center gap-4 p-8">
					<div class="flex h-16 w-16 items-center justify-center rounded-none border-2 border-dashed border-border bg-background">
						<svg class="h-8 w-8 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
						</svg>
					</div>
					<div class="text-center">
						<h3 class="text-lg font-medium">Ready to create</h3>
						<p class="mt-1 text-sm text-muted-foreground">
							Enter a prompt and click Generate to create your post
						</p>
					</div>
				</div>
			{:else if isGenerating}
				<!-- Loading State -->
				<div class="flex flex-1 flex-col items-center justify-center gap-4 p-8">
					<div class="flex h-16 w-16 items-center justify-center rounded-none border border-border bg-background">
						<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					</div>
					<div class="text-center">
						<h3 class="text-lg font-medium">Generating your post</h3>
						<p class="mt-1 text-sm text-muted-foreground">
							Our AI is crafting the perfect content for you...
						</p>
					</div>
				</div>
			{:else}
				<!-- Generated Content -->
				<div class="flex flex-1 overflow-hidden">
					<!-- Image Section -->
					<div class="flex flex-1 flex-col border-r border-border">
						<div class="flex items-center justify-between border-b border-border bg-background px-4 py-3">
							<div class="flex items-center gap-2">
								<h3 class="text-sm font-medium">Generated Image</h3>
								<Badge variant="secondary">1024x1024</Badge>
							</div>
							<div class="flex items-center gap-2">
								<Button variant="outline" size="sm" onclick={handleRegenerate}>
									<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
									</svg>
									Regenerate
								</Button>
								<Button variant="outline" size="sm">
									<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
									</svg>
									Download
								</Button>
							</div>
						</div>
						<div class="flex flex-1 items-center justify-center overflow-auto bg-muted/50 p-8">
							<div class="relative aspect-square w-full max-w-[500px] overflow-hidden border border-border bg-background shadow-sm">
								<img 
									src={mockImageUrl} 
									alt="Generated post" 
									class="h-full w-full object-cover"
								/>
							</div>
						</div>
					</div>

					<!-- Caption Section -->
					<div class="flex w-[380px] shrink-0 flex-col">
						<div class="flex items-center justify-between border-b border-border bg-background px-4 py-3">
							<h3 class="text-sm font-medium">Caption</h3>
							<div class="flex items-center gap-2">
								<Button variant="ghost" size="sm" onclick={handleCopyCaption}>
									<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
									</svg>
									Copy
								</Button>
								<Button variant="ghost" size="sm">
									<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
									</svg>
									Edit
								</Button>
							</div>
						</div>
						<div class="flex flex-1 flex-col overflow-auto bg-background">
							<div class="flex-1 p-4">
								<p class="whitespace-pre-wrap text-sm leading-relaxed">{mockCaption}</p>
							</div>
							
							<!-- Stats and Metadata -->
							<div class="border-t border-border p-4">
								<div class="space-y-3">
									<div class="flex items-center justify-between text-sm">
										<span class="text-muted-foreground">Characters</span>
										<span class="font-mono">{mockCaption.length}</span>
									</div>
									<div class="flex items-center justify-between text-sm">
										<span class="text-muted-foreground">Hashtags</span>
										<span class="font-mono">5</span>
									</div>
									<Separator />
									<div class="flex flex-wrap gap-1.5">
										{#each ["#MorningRoutine", "#Productivity", "#Mindfulness", "#SuccessMindset", "#DailyHabits"] as tag}
											<Badge variant="outline" class="text-xs">{tag}</Badge>
										{/each}
									</div>
								</div>
							</div>
						</div>

						<!-- Action Buttons -->
						<div class="shrink-0 border-t border-border bg-background p-4">
							<div class="flex gap-2">
								<Button variant="outline" class="flex-1">
									Save Draft
								</Button>
								<Button class="flex-1">
									Schedule Post
								</Button>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</main>
	</div>
</div>
