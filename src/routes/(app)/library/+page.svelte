<script lang="ts">
	import {
		Button,
		Badge,
		Textarea,
		Popover,
		PopoverTrigger,
		PopoverContent,
	} from "$lib/components/ui";
	import {
		ImageModelSelector,
		CaptionModelSelector,
		AspectRatioSelector,
		ResolutionSelector,
		ProjectSelector,
		ImageSkeleton,
		ImageGenerationPulseLoader,
		ReferenceImagePicker,
		ImageGenerationErrorModal,
		LibraryFilterBar,
		ImageTemplateSection,
	} from "$lib/components/studio";
	import { SignedIn, SignedOut, SignInButton } from "svelte-clerk";
	import { useConvexClient, useQuery } from "convex-svelte";
	import { api } from "../../../convex/_generated/api.js";
	import type { Id } from "../../../convex/_generated/dataModel.js";
	import { afterNavigate, goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { onMount } from "svelte";
	import Navbar from "$lib/components/Navbar.svelte";
	import { MediaLightbox } from "$lib/components/lightbox";
	import { PostLightbox, AddToPostDialog } from "$lib/components/posts";
	import {
		coerceImageGenerationSettings,
		DEFAULT_STUDIO_IMAGE_MODEL,
		getSupportedAspectRatios,
		getSupportedResolutions,
		type AspectRatio,
		type Resolution,
	} from "$lib/studio/imageGenerationCapabilities";
	import {
		createImageGenerationUiError,
		isImageGenerationErrorCode,
		normalizeImageGenerationError,
		type ImageGenerationUiError,
	} from "$lib/studio/imageGenerationErrors";
	import {
		loadImagesPageState,
		saveImagesPageState,
		type ImagesPageReference,
	} from "$lib/studio/imagesPageState";
	import {
		loadLibraryGalleryFiltersState,
		saveLibraryGalleryFiltersState,
		type LibraryGalleryAssetFilter,
		type LibraryPostPlatformFilter,
		type LibraryPostSchedulingFilter,
		type LibraryMediaLinkFilter,
	} from "$lib/studio/libraryPageFiltersState";
	import { DEFAULT_PRESET, getStylePresetPromptForApi } from "$lib/data/imagePresets";
	import { INSTAGRAM_CAROUSEL_MAX } from "$lib/data/postLimits";
	import {
		filterMediaItems,
		getMediaModelDisplayName,
		getMediaModelOptions,
		getMediaSourceLabel,
		type MediaSortOrder,
		type MediaSourceFilter,
	} from "$lib/studio/mediaBrowserFilters";
	import {
		estimateImageBatchUsage,
		formatCredits,
		sumUsageLineItemCredits,
	} from "$lib/billing/aiCredits";
	import { formatUserFacingMessageFromText } from "$lib/errors";
	import { toast } from "svelte-sonner";

	type MediaItem = {
		_id: Id<"media_items">;
		_creationTime: number;
		url: string | null;
		thumbnailUrl?: string | null;
		model?: string;
		sourceType: string;
		prompt?: string;
		userPrompt?: string;
		generationDurationMs?: number;
		width: number;
		height: number;
		aspectRatio?: string;
		resolution?: string;
		createdAt: number;
		projectId?: Id<"projects">;
		batchId?: Id<"media_generation_batches">;
		storageId: Id<"_storage">;
		mimeType: string;
		deletedAt?: number;
		linkedPostCount?: number;
	};

	type PostCard = {
		_id: Id<"generated_posts">;
		caption: string;
		title?: string;
		platform: string;
		status: string;
		createdAt: number;
		updatedAt: number;
		projectId?: Id<"projects">;
		projectName?: string;
		scheduledFor?: number;
		schedulingStatus?: string;
		mediaCount: number;
		coverUrl: string | null;
		coverThumbnailUrl?: string | null;
		mediaPreview: Array<{
			mediaItemId: Id<"media_items">;
			url: string | null;
			thumbnailUrl?: string | null;
			mimeType: string;
		}>;
	};

	type GridCard =
		| { type: "item"; key: string; item: MediaItem }
		| { type: "pending"; key: string; model: string; aspectRatio?: string }
		| {
			type: "conversationPending";
			key: string;
			model: string;
			aspectRatio?: string;
			title: string;
			conversationId: Id<"image_edit_conversations">;
			updatedAt: number;
		}
		| { type: "post"; key: string; post: PostCard };

	type GalleryLightboxEntry =
		| { kind: "media"; id: Id<"media_items"> }
		| { kind: "post"; id: Id<"generated_posts"> };
	type CreatorMode = "images" | "instagram" | "twitter" | "linkedin";

	type ViewMode = "images" | "conversations";

	type ConversationOutput = {
		_id: Id<"image_edit_outputs">;
		url: string | null;
		thumbnailUrl?: string | null;
		model: string;
		width: number;
		height: number;
		createdAt: number;
	};

	type ConversationTurn = {
		_id: Id<"image_edit_turns">;
		userMessage: string;
		selectedModels: string[];
		aspectRatio: string;
		resolution: string;
		status: string;
		pendingModels?: string[];
		outputs: ConversationOutput[];
		createdAt: number;
	};

	type ConversationSummary = {
		_id: Id<"image_edit_conversations">;
		title: string;
		createdAt: number;
		updatedAt: number;
		turnCount: number;
		sourceImageUrl?: string | null;
		thumbnailUrl?: string | null;
		latestOutputUrl?: string | null;
		latestTurn: ConversationTurn | null;
	};

	type PendingConversationSummary = {
		_id: Id<"image_edit_conversations">;
		title: string;
		updatedAt: number;
		latestTurn: {
			_id: Id<"image_edit_turns">;
			userMessage: string;
			aspectRatio: string;
			resolution: string;
			status: string;
			pendingModels: string[];
		} | null;
	};

	type BillingOverview = {
		activePlanId: string | null;
		accessStatus: string;
		trialEligible: boolean;
		renewalAt: number | null;
		usage: {
			monthlyIncluded: number;
			monthlyUsed: number;
			monthlyRemaining: number;
			totalRemaining: number;
			nextResetAt?: number;
		};
	};

	const client = useConvexClient();
	const ACTIVE_GENERATION_WINDOW_MS = 5 * 60 * 1000;

	let prompt = $state("");
	let selectedModels = $state<string[]>([DEFAULT_STUDIO_IMAGE_MODEL]);
	let aspectRatio = $state<AspectRatio>("1:1");
	let resolution = $state<Resolution>("standard");
	let selectedProjectId = $state<Id<"projects"> | null>(null);
	let manualReferences = $state<{ storageId: Id<"_storage">; previewUrl: string }[]>([]);
	let useProjectContext = $state(true);
	let selectedPreset = $state<string>(DEFAULT_PRESET);
	let isGenerating = $state(false);
	let errorState = $state<ImageGenerationUiError | null>(null);
	let creditEstimate = $derived(
		sumUsageLineItemCredits(estimateImageBatchUsage(selectedModels))
	);
	let promptPlaceholder = $derived("Descreva a imagem que deseja gerar…");
	let billingOverview = $state<BillingOverview | null>(null);
	let billingOverviewLoaded = $state(false);

	let fileInputEl = $state<HTMLInputElement | null>(null);
	let isUploading = $state(false);

	let filterProjectId = $state<Id<"projects"> | null>(null);
	let filterModel = $state("all");
	let filterSource = $state<MediaSourceFilter>("all");
	let sortOrder = $state<MediaSortOrder>("newest");
	let viewMode = $state<ViewMode>(
		(($page.url.searchParams.get("tab") as ViewMode | null) === "conversations")
			? "conversations"
			: "images"
	);

	let activeBatchId = $state<Id<"media_generation_batches"> | null>(null);
	let staleCleanupStarted = $state(false);
	let requestedThumbnailIds = $state<string[]>([]);
	let persistedStateRestored = $state(false);
	let hiddenItemIds = $state<string[]>([]);
	let hiddenPostIds = $state<string[]>([]);
	let selectionMode = $state(false);
	let selectedMediaIds = $state<Id<"media_items">[]>([]);
	let addToPostOpen = $state(false);
	let isBulkSaving = $state(false);
	let selectionOverLimit = $derived(selectedMediaIds.length > INSTAGRAM_CAROUSEL_MAX);
	let creatorMode = $state<CreatorMode>("images");
	let captionModel = $state("moonshotai/kimi-k2-0905");
	let postGenerationPending = $state<{
		model: string;
		aspectRatio: string;
		imageCount: number;
		startedAt: number;
	} | null>(null);
	let generationLoaderLabel = $derived(
		creatorMode === "instagram" ? "Gerando Post..." : "Gerando Imagem..."
	);
	let generateButtonLabel = $derived(
		creatorMode === "instagram" ? "Gerar Post" : "Gerar Imagem"
	);

	let galleryAssetFilter = $state<LibraryGalleryAssetFilter>("all");
	let postPlatformFilter = $state<LibraryPostPlatformFilter>("all");
	let postSchedulingFilter = $state<LibraryPostSchedulingFilter>("all");
	let mediaLinkFilter = $state<LibraryMediaLinkFilter>("all");
	let gallerySearch = $state("");
	let debouncedGallerySearch = $state("");

	let initialProjectId = $derived($page.url.searchParams.get("projectId") as Id<"projects"> | null);
	let lightboxMediaId = $derived($page.url.searchParams.get("view"));
	let lightboxOpen = $derived(!!lightboxMediaId);
	let lightboxPostId = $derived(($page.url.searchParams.get("viewPost") as Id<"generated_posts"> | null) ?? null);
	let postLightboxOpen = $derived(!!lightboxPostId);

	onMount(() => {
		const savedState = loadImagesPageState();
		if (savedState) {
			prompt = savedState.prompt;
			selectedModels = savedState.selectedModels.length > 0 ? savedState.selectedModels : selectedModels;
			aspectRatio = savedState.aspectRatio;
			resolution = savedState.resolution;
			selectedProjectId = initialProjectId ?? (savedState.selectedProjectId as Id<"projects"> | null);
			manualReferences = savedState.manualReferences as ImagesPageReference[] as {
				storageId: Id<"_storage">;
				previewUrl: string;
			}[];
			filterProjectId = savedState.filterProjectId as Id<"projects"> | null;
			filterModel = savedState.filterModel;
			filterSource = savedState.filterSource;
			sortOrder = savedState.sortOrder;
			if (!$page.url.searchParams.has("tab")) {
				viewMode = savedState.viewMode;
			}
			useProjectContext = savedState.useProjectContext;
			selectedPreset = savedState.selectedPreset;
		}

		const gallerySaved = loadLibraryGalleryFiltersState();
		if (gallerySaved) {
			galleryAssetFilter = gallerySaved.galleryAssetFilter;
			postPlatformFilter = gallerySaved.postPlatformFilter;
			postSchedulingFilter = gallerySaved.postSchedulingFilter;
			mediaLinkFilter = gallerySaved.mediaLinkFilter;
			gallerySearch = gallerySaved.gallerySearch;
			debouncedGallerySearch = gallerySaved.gallerySearch.trim();
		}

		persistedStateRestored = true;

		void loadBillingOverview();
	});

	async function loadBillingOverview() {
		try {
			const data = await client.action((api as any).billing.autumn.getBillingOverview, {});
			billingOverview = data ?? null;
		} catch (error) {
			console.error("Failed to load billing overview for images page:", error);
			billingOverview = null;
		} finally {
			billingOverviewLoaded = true;
		}
	}

	function formatPercent(value: number): string {
		const normalized = Math.max(0, Math.min(100, value));
		const formatter = new Intl.NumberFormat("pt-BR", {
			minimumFractionDigits: normalized > 0 && normalized < 1 ? 1 : 0,
			maximumFractionDigits: normalized >= 10 || Number.isInteger(normalized) ? 0 : 1,
		});
		return `${formatter.format(normalized)}%`;
	}

	function openLightbox(mediaId: string) {
		const url = new URL($page.url);
		url.searchParams.delete("viewPost");
		url.searchParams.set("view", mediaId);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function closeLightbox() {
		const url = new URL($page.url);
		url.searchParams.delete("view");
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function navigateLightbox(mediaId: string) {
		const url = new URL($page.url);
		url.searchParams.delete("viewPost");
		url.searchParams.set("view", mediaId);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function openPostLightbox(postId: Id<"generated_posts">) {
		const url = new URL($page.url);
		url.searchParams.delete("view");
		url.searchParams.set("viewPost", postId);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function closePostLightbox() {
		const url = new URL($page.url);
		url.searchParams.delete("viewPost");
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function navigatePostLightbox(postId: Id<"generated_posts">) {
		const url = new URL($page.url);
		url.searchParams.set("viewPost", postId);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function navigateToGalleryEntry(entry: GalleryLightboxEntry) {
		if (entry.kind === "media") {
			navigateLightbox(entry.id);
			return;
		}
		navigatePostLightbox(entry.id);
	}

	function setViewMode(mode: ViewMode) {
		viewMode = mode;
		const url = new URL($page.url);
		if (mode === "images") {
			url.searchParams.delete("tab");
		} else {
			url.searchParams.set("tab", mode);
			url.searchParams.delete("view");
			url.searchParams.delete("viewPost");
		}
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	function selectCreatorMode(mode: CreatorMode) {
		if (mode === "twitter") {
			toast.info("Em breve", { description: "Criação para X chega em breve." });
			return;
		}
		if (mode === "linkedin") {
			toast.info("Em breve", { description: "Criação para LinkedIn chega em breve." });
			return;
		}
		creatorMode = mode;
	}

	const projectsQuery = useQuery(api.projects.list, () => ({}));
	const postsCardsQuery = useQuery(api.generatedPosts.listCardsByUser, () => ({ limit: 120 }));
	const allItemsQuery = useQuery(api.mediaItems.listAllCardsByUser, () => ({}));
	const conversationsQuery = useQuery(
		api.imageEditConversations.listByUser,
		() => viewMode === "conversations" ? {} : "skip"
	);
	const pendingConversationsQuery = useQuery(
		api.imageEditConversations.listPendingByUser,
		() =>
			viewMode === "images" && galleryAssetFilter !== "posts"
				? { limit: 12, staleAfterMs: ACTIVE_GENERATION_WINDOW_MS }
				: "skip"
	);
	const recentBatchesQuery = useQuery(api.mediaGenerationBatches.listByUser, () => ({ limit: 6 }));
	const batchQuery = useQuery(
		api.mediaGenerationBatches.get,
		() => activeBatchId ? { id: activeBatchId } : "skip"
	);
	const batchItemsQuery = useQuery(
		api.mediaItems.listByBatch,
		() => activeBatchId ? { batchId: activeBatchId } : "skip"
	);
	const selectedProjectQuery = useQuery(
		api.projects.get,
		() => selectedProjectId ? { projectId: selectedProjectId } : "skip"
	);
	const contextImagesQuery = useQuery(
		api.contextImages.list,
		() => selectedProjectId ? { projectId: selectedProjectId } : "skip"
	);

	let selectedProject = $derived(selectedProjectQuery.data);
	let contextImages = $derived(contextImagesQuery.data ?? []);
	let projects = $derived(projectsQuery.data ?? []);
	let allUserItems = $derived(
		((allItemsQuery.data ?? []) as MediaItem[]).filter((item) => !hiddenItemIds.includes(item._id))
	);
	let recentBatches = $derived(recentBatchesQuery.data ?? []);
	let batchData = $derived(batchQuery.data);
	let batchItems = $derived(batchItemsQuery.data ?? []);
	let modelOptions = $derived(getMediaModelOptions(allUserItems));
	let supportedAspectRatios = $derived(getSupportedAspectRatios(selectedModels));
	let supportedResolutions = $derived(getSupportedResolutions(selectedModels));
	let filtersAreDefault = $derived(
		filterProjectId === null &&
		filterModel === "all" &&
		filterSource === "all" &&
		sortOrder === "newest" &&
		galleryAssetFilter === "all" &&
		postPlatformFilter === "all" &&
		postSchedulingFilter === "all" &&
		mediaLinkFilter === "all" &&
		!debouncedGallerySearch.trim()
	);
	let showGeneratingBatchCards = $derived(
		galleryAssetFilter !== "posts" &&
		!!activeBatchId &&
		!!batchData &&
		batchData.status === "generating" &&
		Date.now() - batchLastProgressAt(batchData) < ACTIVE_GENERATION_WINDOW_MS &&
		sortOrder === "newest" &&
		filterSource !== "edited" &&
		(!filterProjectId || batchData.projectId === filterProjectId) &&
		(filterModel === "all" || (batchData?.pendingModels ?? []).includes(filterModel))
	);

	$effect(() => {
		const normalized = coerceImageGenerationSettings(selectedModels, aspectRatio, resolution);
		if (normalized.aspectRatio !== aspectRatio) {
			aspectRatio = normalized.aspectRatio;
		}
		if (normalized.resolution !== resolution) {
			resolution = normalized.resolution;
		}
	});

	$effect(() => {
		if (initialProjectId && !selectedProjectId) {
			selectedProjectId = initialProjectId;
		}
	});

	$effect(() => {
		const nextMode =
			($page.url.searchParams.get("tab") as ViewMode | null) === "conversations"
				? "conversations"
				: "images";
		if ($page.url.searchParams.has("tab") && nextMode !== viewMode) {
			viewMode = nextMode;
		}
	});

	// Navbar / logo link to `/library` drops `?tab=conversations` but the effect above only
	// runs when `tab` is present, so `viewMode` would stay on "conversations" until a second interaction.
	afterNavigate(({ from, to }) => {
		if (!to || to.url.pathname !== "/library") return;
		if (to.url.searchParams.get("tab") === "conversations") return;
		const leftConversationsTab =
			from != null &&
			from.url.pathname === "/library" &&
			from.url.searchParams.get("tab") === "conversations";
		if (leftConversationsTab) {
			viewMode = "images";
		}
	});

	$effect(() => {
		const timeout = setTimeout(() => {
			debouncedGallerySearch = gallerySearch.trim();
		}, 200);
		return () => clearTimeout(timeout);
	});

	$effect(() => {
		if (!persistedStateRestored) return;

		saveLibraryGalleryFiltersState({
			galleryAssetFilter,
			postPlatformFilter,
			postSchedulingFilter,
			mediaLinkFilter,
			gallerySearch,
		});
	});

	$effect(() => {
		if (!persistedStateRestored) return;

		saveImagesPageState({
			prompt,
			selectedModels,
			aspectRatio,
			resolution,
			selectedProjectId,
			manualReferences: manualReferences.map((reference) => ({
				storageId: reference.storageId,
				previewUrl: reference.previewUrl,
			})),
			filterProjectId,
			filterModel,
			filterSource,
			sortOrder,
			viewMode,
			useProjectContext,
			selectedPreset,
		});
	});

	$effect(() => {
		if (activeBatchId || recentBatches.length === 0) return;
		const candidate = recentBatches.find((batch) => batch.status === "generating");
		if (candidate && Date.now() - (batchLastProgressAt(candidate) ?? candidate.createdAt) < ACTIVE_GENERATION_WINDOW_MS) {
			activeBatchId = candidate._id;
		}
	});

	$effect(() => {
		if (viewMode !== "images" || staleCleanupStarted) return;
		staleCleanupStarted = true;

		void Promise.allSettled([
			client.mutation(api.imageEditConversations.cleanupStalePendingByUser, {
				staleAfterMs: ACTIVE_GENERATION_WINDOW_MS,
			}),
			client.mutation(api.mediaGenerationBatches.cleanupStaleByUser, {
				staleAfterMs: ACTIVE_GENERATION_WINDOW_MS,
			}),
		]);
	});

	$effect(() => {
		if (batchData?.status === "completed") {
			activeBatchId = null;
		}

		if (
			batchData?.status === "generating" &&
			Date.now() - batchLastProgressAt(batchData) >= ACTIVE_GENERATION_WINDOW_MS
		) {
			activeBatchId = null;
		}

		if (batchData?.status === "error") {
			const safeDetail = formatUserFacingMessageFromText(batchData.lastErrorMessage);
			errorState = createImageGenerationUiError(
				isImageGenerationErrorCode(batchData.lastErrorCode)
					? batchData.lastErrorCode
					: "GENERATION_FAILED",
				{
					message: safeDetail,
					summary: safeDetail,
				}
			);
			activeBatchId = null;
		}
		});

	$effect(() => {
		if (viewMode !== "images") return;

		const idsToEnsure = itemsVisibleInLibrary
			.filter((item) => item.url && !item.thumbnailUrl)
			.map((item) => item._id)
			.filter((id) => !requestedThumbnailIds.includes(id))
			.slice(0, 24);

		if (idsToEnsure.length === 0) return;

		requestedThumbnailIds = [...requestedThumbnailIds, ...idsToEnsure];
		void client.mutation(api.mediaItems.ensureThumbnails, { ids: idsToEnsure }).catch((err) => {
			console.error("Failed to queue thumbnails:", err);
		});
	});

	let items = $derived(
		filterMediaItems(allUserItems, {
			projectId: filterProjectId,
			model: filterModel,
			source: filterSource,
			sortOrder,
		})
	);

	let itemsVisibleInLibrary = $derived.by(() => {
		const q = debouncedGallerySearch.trim().toLowerCase();
		let list = items;
		if (mediaLinkFilter === "linked") {
			list = list.filter((item) => (item.linkedPostCount ?? 0) > 0);
		} else if (mediaLinkFilter === "unlinked") {
			list = list.filter((item) => (item.linkedPostCount ?? 0) === 0);
		}
		if (!q) return list;
		return list.filter((item) => {
			const hay = `${item.userPrompt ?? ""} ${item.prompt ?? ""}`.toLowerCase();
			return hay.includes(q);
		});
	});

	let rawPostCards = $derived(
		((postsCardsQuery.data ?? []) as PostCard[]).filter((post) => !hiddenPostIds.includes(post._id))
	);

	let filteredPostCards = $derived.by(() => {
		let list = [...rawPostCards];
		if (filterProjectId) {
			list = list.filter((post) => post.projectId === filterProjectId);
		}
		if (postPlatformFilter !== "all") {
			list = list.filter((post) => post.platform === postPlatformFilter);
		}
		if (postSchedulingFilter === "scheduled") {
			list = list.filter((post) => post.schedulingStatus === "scheduled");
		}
		if (postSchedulingFilter === "draft") {
			list = list.filter((post) => post.schedulingStatus !== "scheduled");
		}
		const q = debouncedGallerySearch.trim().toLowerCase();
		if (q) {
			list = list.filter(
				(post) =>
					(post.title?.toLowerCase().includes(q) ?? false) ||
					post.caption.toLowerCase().includes(q) ||
					(post.projectName?.toLowerCase().includes(q) ?? false)
			);
		}
		list.sort((a, b) =>
			sortOrder === "oldest" ? a.updatedAt - b.updatedAt : b.updatedAt - a.updatedAt
		);
		return list;
	});

	let lightboxItems = $derived(itemsVisibleInLibrary);

	function toPostLightboxItem(p: PostCard) {
		return {
			_id: p._id,
			caption: p.caption,
		...(p.title !== undefined ? { title: p.title } : {}),
			platform: p.platform,
		...(p.projectId !== undefined ? { projectId: p.projectId } : {}),
		...(p.projectName !== undefined ? { projectName: p.projectName } : {}),
		...(p.scheduledFor !== undefined ? { scheduledFor: p.scheduledFor } : {}),
		...(p.schedulingStatus !== undefined ? { schedulingStatus: p.schedulingStatus } : {}),
			updatedAt: p.updatedAt,
			mediaCount: p.mediaCount,
		};
	}

	let postLightboxNavItems = $derived.by(() => {
		const mapped = filteredPostCards.map(toPostLightboxItem);
		const id = lightboxPostId;
		if (!id) return mapped;
		if (mapped.some((p) => p._id === id)) return mapped;
		const fallback = rawPostCards.find((p) => p._id === id);
		return fallback ? [toPostLightboxItem(fallback)] : mapped;
	});

	let conversations = $derived((conversationsQuery.data ?? []) as ConversationSummary[]);
	let pendingConversations = $derived((pendingConversationsQuery.data ?? []) as PendingConversationSummary[]);
	let conversationPendingCards = $derived(() => {
		if (
			!filtersAreDefault ||
			filterSource === "edited" ||
			galleryAssetFilter === "posts"
		) {
			return [] as GridCard[];
		}

		return pendingConversations
			.filter((conversation) => (conversation.latestTurn?.pendingModels?.length ?? 0) > 0)
			.flatMap((conversation) =>
				(conversation.latestTurn?.pendingModels ?? []).map((model) => ({
					type: "conversationPending" as const,
					key: `conversation-pending-${conversation._id}-${model}`,
					model,
					...(conversation.latestTurn?.aspectRatio
						? { aspectRatio: conversation.latestTurn.aspectRatio }
						: {}),
					title: conversation.latestTurn?.userMessage?.trim() || conversation.title,
					conversationId: conversation._id,
					updatedAt: conversation.updatedAt,
				}))
			);
	});

	function gridCardSortTs(card: GridCard, batchProgressTs: number): number {
		if (card.type === "item") return card.item.createdAt;
		if (card.type === "post") return card.post.updatedAt;
		if (card.type === "conversationPending") return card.updatedAt;
		if (card.type === "pending") return batchProgressTs;
		return 0;
	}

	let mediaGridCards = $derived(() => {
		if (galleryAssetFilter === "posts") {
			return [] as GridCard[];
		}

		const cards: GridCard[] = [];
		const activeIds = new Set(batchItems.map((item) => item._id));

		for (const pendingCard of conversationPendingCards()) {
			cards.push(pendingCard);
		}

		if (postGenerationPending) {
			for (let i = 0; i < postGenerationPending.imageCount; i++) {
				cards.push({
					type: "pending",
					key: `post-img-pending-${postGenerationPending.startedAt}-${i}`,
					model: postGenerationPending.model,
					aspectRatio: postGenerationPending.aspectRatio,
				});
			}
		}

		if (showGeneratingBatchCards) {
			for (const item of batchItems) {
				cards.push({ type: "item", key: item._id, item });
			}

			for (const model of batchData?.pendingModels ?? []) {
				cards.push({
					type: "pending",
					key: `pending-${activeBatchId}-${model}`,
					model,
					...(batchData?.aspectRatio ? { aspectRatio: batchData.aspectRatio } : {}),
				});
			}
		}

		for (const item of itemsVisibleInLibrary) {
			if (activeIds.has(item._id)) continue;
			cards.push({ type: "item", key: item._id, item });
		}

		return cards;
	});

	let postGridCards = $derived(() => {
		if (galleryAssetFilter === "media") {
			return [] as GridCard[];
		}
		return filteredPostCards.map((post) => ({
			type: "post" as const,
			key: `post-${post._id}`,
			post,
		}));
	});

	let gridCards = $derived(() => {
		const batchProgressTs = batchLastProgressAt(batchData ?? { createdAt: Date.now() });
		const media = mediaGridCards();
		const posts = postGridCards();
		const combined = [...media, ...posts];
		const dir = sortOrder === "oldest" ? 1 : -1;
		return [...combined].sort(
			(a, b) => dir * (gridCardSortTs(a, batchProgressTs) - gridCardSortTs(b, batchProgressTs))
		);
	});

	let galleryLightboxSequence = $derived.by(() => {
		const entries: GalleryLightboxEntry[] = [];
		for (const card of gridCards()) {
			if (card.type === "item") {
				entries.push({ kind: "media", id: card.item._id });
			}
			if (card.type === "post") {
				entries.push({ kind: "post", id: card.post._id });
			}
		}
		return entries;
	});

	let currentGalleryEntry = $derived.by(() => {
		if (lightboxPostId) {
			return { kind: "post", id: lightboxPostId } as const;
		}
		if (lightboxMediaId) {
			return { kind: "media", id: lightboxMediaId as Id<"media_items"> } as const;
		}
		return null;
	});

	let currentGalleryIndex = $derived.by(() => {
		const current = currentGalleryEntry;
		if (!current) return -1;
		return galleryLightboxSequence.findIndex(
			(entry) => entry.kind === current.kind && entry.id === current.id
		);
	});

	let galleryCanPrev = $derived(currentGalleryIndex > 0);
	let galleryCanNext = $derived(
		currentGalleryIndex >= 0 && currentGalleryIndex < galleryLightboxSequence.length - 1
	);
	let galleryCounterText = $derived.by(() => {
		const index = currentGalleryIndex;
		const total = galleryLightboxSequence.length;
		if (index < 0 || total === 0) return "";
		return `${index + 1} / ${total}`;
	});

	function navigateGalleryPrev() {
		const index = currentGalleryIndex;
		if (index <= 0) return;
		const previous = galleryLightboxSequence[index - 1];
		if (!previous) return;
		navigateToGalleryEntry(previous);
	}

	function navigateGalleryNext() {
		const index = currentGalleryIndex;
		if (index < 0 || index >= galleryLightboxSequence.length - 1) return;
		const next = galleryLightboxSequence[index + 1];
		if (!next) return;
		navigateToGalleryEntry(next);
	}

	let viewportWidth = $state(typeof window !== "undefined" ? window.innerWidth : 1280);

	const LG_BREAKPOINT = 1024;
	let sidebarOpen = $state(typeof window !== "undefined" ? window.innerWidth >= LG_BREAKPOINT : true);

	$effect(() => {
		let previousWidth = viewportWidth;
		function onResize() {
			const newWidth = window.innerWidth;
			viewportWidth = newWidth;
			if (previousWidth >= LG_BREAKPOINT && newWidth < LG_BREAKPOINT) sidebarOpen = false;
			if (previousWidth < LG_BREAKPOINT && newWidth >= LG_BREAKPOINT) sidebarOpen = true;
			previousWidth = newWidth;
		}
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	});

	let effectiveMainWidth = $derived(viewportWidth - (sidebarOpen ? 320 : 0));
	let columnCount = $derived(
		effectiveMainWidth < 640 ? 1 :
		effectiveMainWidth < 1024 ? 2 :
		effectiveMainWidth < 1280 ? 3 :
		effectiveMainWidth < 1536 ? 4 : 5
	);

	const CARD_META_HEIGHT = 0.18; // estimated relative height of title+date area

	function getCardEstimatedHeight(card: GridCard): number {
		if (card.type === "item") {
			const ratio = getMediaAspectRatio(card.item);
			const [w, h] = ratio.split(" / ").map(Number);
			return (w && h ? h / w : 1) + CARD_META_HEIGHT;
		}
		if (card.type === "post") {
			return 1 + CARD_META_HEIGHT;
		}
		const ar = card.aspectRatio ?? "1:1";
		const [w, h] = ar.split(":").map(Number);
		return (w && h ? h / w : 1) + CARD_META_HEIGHT;
	}

		let columnCards = $derived(() => {
			const cards = gridCards();
			const cols: GridCard[][] = Array.from({ length: columnCount }, () => []);
			const heights = new Array(columnCount).fill(0);
			for (const card of cards) {
				const shortest = heights.indexOf(Math.min(...heights));
				const column = cols[shortest];
				if (!column) continue;
				column.push(card);
				heights[shortest] += getCardEstimatedHeight(card);
			}
			return cols;
		});

	let isLoading = $derived(
		(galleryAssetFilter !== "posts" && allItemsQuery.isLoading) ||
			(galleryAssetFilter !== "media" && postsCardsQuery.isLoading)
	);

	let galleryItemCount = $derived(
		(galleryAssetFilter === "posts" ? 0 : itemsVisibleInLibrary.length) +
			(galleryAssetFilter === "media" ? 0 : filteredPostCards.length)
	);

	let batchPendingCount = $derived(showGeneratingBatchCards ? batchData?.pendingModels?.length ?? 0 : 0);
	let conversationPendingCount = $derived(conversationPendingCards().length);
	let postImagePendingCount = $derived(postGenerationPending?.imageCount ?? 0);
	let pendingCount = $derived(batchPendingCount + conversationPendingCount + postImagePendingCount);
	let activeConversationCount = $derived(
		conversations.filter(
			(conversation) => (conversation.latestTurn?.pendingModels?.length ?? 0) > 0
		).length
	);
	let planUsageEstimatePercent = $derived(
		billingOverview?.usage?.monthlyIncluded
			? (creditEstimate / Math.max(billingOverview.usage.monthlyIncluded, 1)) * 100
			: null
	);
	let monthlyRemainingPercent = $derived(
		billingOverview?.usage?.monthlyIncluded
			? (billingOverview.usage.monthlyRemaining /
				Math.max(billingOverview.usage.monthlyIncluded, 1)) *
				100
			: null
	);

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleDateString("pt-BR", {
			day: "2-digit",
			month: "short",
			year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
		});
	}

	function getModelDisplayName(model?: string): string {
		return getMediaModelDisplayName(model);
	}

	function getSourceLabel(sourceType: string): string {
		return getMediaSourceLabel(sourceType);
	}

	function toAspectRatioValue(aspectRatio?: string): string {
		if (!aspectRatio) return "1 / 1";
		const [width, height] = aspectRatio.split(":");
		if (!width || !height) return "1 / 1";
		return `${width} / ${height}`;
	}

	function getMediaAspectRatio(item: Pick<MediaItem, "width" | "height" | "aspectRatio">): string {
		if (item.width > 0 && item.height > 0) {
			return `${item.width} / ${item.height}`;
		}
		return toAspectRatioValue(item.aspectRatio);
	}

	function getCardTitle(item: MediaItem): string {
		return item.model ? getModelDisplayName(item.model) : getSourceLabel(item.sourceType);
	}

	function getCardMeta(item: MediaItem): string {
		const parts = [formatDate(item.createdAt)];
		if (item.aspectRatio) {
			parts.push(item.aspectRatio);
		} else if (item.width > 0 && item.height > 0) {
			parts.push(`${item.width} × ${item.height}`);
		}
		return parts.join(" • ");
	}

	function formatRelativeTime(timestamp: number): string {
		const diff = Date.now() - timestamp;
		if (diff < 60_000) return "Agora";
		if (diff < 60 * 60_000) return `${Math.max(1, Math.floor(diff / 60_000))} min`;
		if (diff < 24 * 60 * 60_000) return `${Math.max(1, Math.floor(diff / 3_600_000))} h`;
		if (diff < 7 * 24 * 60 * 60_000) return `${Math.max(1, Math.floor(diff / 86_400_000))} d`;
		return formatDate(timestamp);
	}

	function batchLastProgressAt(batch: { lastProgressAt?: number; createdAt: number }): number {
		return batch.lastProgressAt ?? batch.createdAt;
	}

	function getConversationTitle(conversation: ConversationSummary): string {
		return conversation.latestTurn?.userMessage?.trim() || conversation.title;
	}

	function getConversationOutputCount(conversation: ConversationSummary): number {
		if (!conversation.latestTurn) return 0;
		return conversation.latestTurn.outputs.length + (conversation.latestTurn.pendingModels?.length ?? 0);
	}

	function openConversation(conversationId: Id<"image_edit_conversations">) {
		goto(`/library/conversations/${conversationId}`);
	}

	function clearErrorState() {
		errorState = null;
	}

	function showError(error: unknown, fallbackCode?: Parameters<typeof normalizeImageGenerationError>[1]) {
		errorState = normalizeImageGenerationError(error, fallbackCode);
	}

	async function handleGenerate() {
		if (!prompt.trim() || isGenerating) return;
		isGenerating = true;
		clearErrorState();

		try {
			const normalized = coerceImageGenerationSettings(selectedModels, aspectRatio, resolution);
			aspectRatio = normalized.aspectRatio;
			resolution = normalized.resolution;

			const contextImageUrls = contextImages
				.map((image) => image.url)
				.filter((url): url is string => !!url);
			const projectContext = selectedProject && selectedProjectId && useProjectContext ? {
				...(selectedProject.brandContextMarkdown?.trim() && {
					brandContextMarkdown: selectedProject.brandContextMarkdown.trim(),
				}),
				...(selectedProject.accountDescription && { accountDescription: selectedProject.accountDescription }),
				...(selectedProject.brandTraits && { brandTraits: selectedProject.brandTraits }),
				...(selectedProject.additionalContext && { additionalContext: selectedProject.additionalContext }),
				...(contextImageUrls.length > 0 && { contextImageUrls }),
			} : undefined;

			const stylePresetPrompt = getStylePresetPromptForApi(selectedPreset);

			if (creatorMode === "instagram") {
				const imageModel = selectedModels[0] ?? DEFAULT_STUDIO_IMAGE_MODEL;
				postGenerationPending = {
					model: imageModel,
					aspectRatio: normalized.aspectRatio,
					imageCount: 1,
					startedAt: Date.now(),
				};
				const composed = await client.action(api.ai.composePostFromBrief.composeFromBrief, {
					brief: prompt.trim(),
					imageModel,
					captionModel,
					aspectRatio: normalized.aspectRatio,
					resolution: normalized.resolution,
					...(selectedProjectId && { projectId: selectedProjectId }),
					...(projectContext && { projectContext }),
					...(stylePresetPrompt && { stylePreset: stylePresetPrompt }),
				});

				const postId = await client.mutation(api.generatedPosts.saveComposedDraft, {
					...(selectedProjectId && { projectId: selectedProjectId }),
					platform: "instagram",
					caption: composed.caption,
					mediaItemIds: composed.mediaItemIds,
				});
				if (composed.captionFallbackUsed && !composed.captionFailed) {
					toast.warning("Legenda gerada com fallback", {
						description:
							`O modelo ${composed.captionModelRequested ?? captionModel} falhou. ` +
							`Usamos ${composed.captionModelUsed ?? "Google Flash 2.5"} para concluir a legenda.`,
					});
				}
				if (composed.captionFailed) {
					toast.warning("Post criado sem legenda", {
						description:
							"Imagem gerada, mas o modelo de legenda falhou. Edite a legenda manualmente no post.",
					});
				}
				openPostLightbox(postId);
			} else {
				const result = await client.action(api.ai.generateImages.generate, {
					...(selectedProjectId && { projectId: selectedProjectId }),
					message: prompt.trim(),
					imageModels: selectedModels,
					aspectRatio: normalized.aspectRatio,
					resolution: normalized.resolution,
					...(projectContext && { projectContext }),
					...(manualReferences.length > 0 && {
						manualReferenceIds: manualReferences.map((r) => r.storageId),
					}),
					...(stylePresetPrompt && { stylePreset: stylePresetPrompt }),
				});
				activeBatchId = result.batchId;
			}
			prompt = "";
			void loadBillingOverview();
		} catch (err: any) {
			console.error("[library] generation failed", {
				creatorMode,
				selectedProjectId,
				selectedModels,
				aspectRatio,
				resolution,
				error: err,
			});
			if (creatorMode === "instagram") {
				toast.error("Falha ao gerar post", {
					description: "Confira o console para detalhes e tente novamente.",
				});
			}
			showError(err, "GENERATION_FAILED");
		} finally {
			postGenerationPending = null;
			isGenerating = false;
		}
	}

	async function handleUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;

		isUploading = true;
		clearErrorState();
		try {
			for (const file of Array.from(input.files)) {
				if (!file.type.startsWith("image/")) continue;

				const dimensions = await getImageDimensions(file);
				const uploadUrl = await client.mutation(api.referenceImages.generateUploadUrl, {});
				const uploadResult = await fetch(uploadUrl, {
					method: "POST",
					headers: { "Content-Type": file.type },
					body: file,
				});
				const { storageId } = await uploadResult.json();

				await client.mutation(api.mediaItems.createUploaded, {
					storageId,
					mimeType: file.type,
					width: dimensions.width,
					height: dimensions.height,
					...(selectedProjectId && { projectId: selectedProjectId }),
				});
			}

			} catch (err: any) {
				showError(err, "UPLOAD_FAILED");
			} finally {
			isUploading = false;
			input.value = "";
		}
	}

	function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
		return new Promise((resolve) => {
			const image = new Image();
			image.onload = () => {
				resolve({ width: image.width, height: image.height });
				URL.revokeObjectURL(image.src);
			};
			image.onerror = () => resolve({ width: 1024, height: 1024 });
			image.src = URL.createObjectURL(file);
		});
	}

	async function handleDelete(id: Id<"media_items">, event: Event) {
		event.stopPropagation();
		await client.mutation(api.mediaItems.softDelete, { id });
		hiddenItemIds = [...hiddenItemIds, id];
	}

	function enterSelectionMode(initialId?: Id<"media_items">) {
		selectionMode = true;
		if (initialId && !selectedMediaIds.includes(initialId)) {
			selectedMediaIds = [...selectedMediaIds, initialId];
		}
	}

	function exitSelectionMode() {
		selectionMode = false;
		selectedMediaIds = [];
	}

	function toggleMediaSelection(id: Id<"media_items">) {
		if (selectedMediaIds.includes(id)) {
			selectedMediaIds = selectedMediaIds.filter((x) => x !== id);
			return;
		}
		selectedMediaIds = [...selectedMediaIds, id];
	}

	function isMediaSelected(id: Id<"media_items">): boolean {
		return selectedMediaIds.includes(id);
	}

	function selectionIndex(id: Id<"media_items">): number {
		return selectedMediaIds.indexOf(id) + 1;
	}

	async function createPostFromSelection() {
		if (selectedMediaIds.length === 0 || isBulkSaving) return;
		if (selectedMediaIds.length > INSTAGRAM_CAROUSEL_MAX) {
			toast.warning(
				`Instagram permite no máximo ${INSTAGRAM_CAROUSEL_MAX} mídias por carrossel.`
			);
			return;
		}
		isBulkSaving = true;
		try {
			const newPostId = await client.mutation(api.generatedPosts.saveComposedDraft, {
				caption: "",
				platform: "instagram",
				mediaItemIds: [...selectedMediaIds],
				...(selectedProjectId && { projectId: selectedProjectId }),
			});
			toast.success(`Post criado com ${selectedMediaIds.length} ${selectedMediaIds.length === 1 ? "imagem" : "imagens"}`);
			exitSelectionMode();
			openPostLightbox(newPostId);
		} catch (err) {
			console.error("[library] createPostFromSelection failed", err);
			toast.error("Não foi possível criar o post");
		} finally {
			isBulkSaving = false;
		}
	}

	async function appendSelectionToPost(postId: Id<"generated_posts">) {
		if (selectedMediaIds.length === 0 || isBulkSaving) return;
		isBulkSaving = true;
		try {
			const result = await client.mutation(api.postMediaItems.appendManyToPost, {
				postId,
				mediaItemIds: [...selectedMediaIds],
			});
			if (result.added === 0) {
				if (result.skippedAlreadyLinked > 0 && result.skippedDueToLimit === 0) {
					toast.info("Essas imagens já estão no post");
				} else if (result.skippedDueToLimit > 0) {
					toast.warning(`Post já atingiu o limite de ${INSTAGRAM_CAROUSEL_MAX} mídias`);
				} else {
					toast.info("Nada para adicionar");
				}
			} else {
				const pieces = [
					`${result.added} ${result.added === 1 ? "imagem adicionada" : "imagens adicionadas"}`,
				];
				if (result.skippedAlreadyLinked > 0) {
					pieces.push(`${result.skippedAlreadyLinked} já estava${result.skippedAlreadyLinked === 1 ? "" : "m"} no post`);
				}
				if (result.skippedDueToLimit > 0) {
					pieces.push(`${result.skippedDueToLimit} ignorada${result.skippedDueToLimit === 1 ? "" : "s"} pelo limite de ${INSTAGRAM_CAROUSEL_MAX}`);
				}
				toast.success(pieces.join(" · "));
			}
			addToPostOpen = false;
			exitSelectionMode();
			if (result.added > 0) {
				openPostLightbox(postId);
			}
		} catch (err) {
			console.error("[library] appendSelectionToPost failed", err);
			toast.error("Não foi possível adicionar ao post");
		} finally {
			isBulkSaving = false;
		}
	}

	async function deleteSelection() {
		if (selectedMediaIds.length === 0 || isBulkSaving) return;
		const count = selectedMediaIds.length;
		const confirmed = confirm(
			`Mover ${count} ${count === 1 ? "imagem" : "imagens"} para a lixeira?`
		);
		if (!confirmed) return;
		isBulkSaving = true;
		try {
			const ids = [...selectedMediaIds];
			await client.mutation(api.mediaItems.softDeleteMany, { ids });
			hiddenItemIds = [...hiddenItemIds, ...ids];
			toast.success(`${count} ${count === 1 ? "imagem removida" : "imagens removidas"}`);
			exitSelectionMode();
		} catch (err) {
			console.error("[library] deleteSelection failed", err);
			toast.error("Não foi possível excluir as imagens");
		} finally {
			isBulkSaving = false;
		}
	}

	async function handleDeletePost(id: Id<"generated_posts">, event: Event) {
		event.stopPropagation();
		await client.mutation(api.generatedPosts.softDelete, { id });
		hiddenPostIds = [...hiddenPostIds, id];
	}


	function postSchedulingLabel(schedulingStatus?: string): string {
		return schedulingStatus === "scheduled" ? "Agendado" : "Rascunho";
	}

	function postPlatformLabel(platform: string): string {
		if (platform === "instagram") return "Instagram";
		if (platform === "twitter") return "X";
		if (platform === "linkedin") return "LinkedIn";
		return platform;
	}

	async function handleDownload(url: string, event: Event) {
		event.stopPropagation();
		try {
			const response = await fetch(url);
			const blob = await response.blob();
			const blobUrl = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = blobUrl;
			link.download = `vanda-${Date.now()}.png`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(blobUrl);
		} catch (err) {
			console.error("Download failed:", err);
		}
	}

</script>

<svelte:head>
	<title>Galeria - Vanda Studio</title>
</svelte:head>

<div class="flex h-screen flex-col bg-background">
	<Navbar />

	<div class="flex flex-1 overflow-hidden">
		<aside
			class="shrink-0 flex flex-col overflow-hidden transition-[width] duration-300 ease-in-out {sidebarOpen ? 'border-r border-border bg-muted/20' : ''}"
			style="width: {sidebarOpen ? '20rem' : '0rem'}"
		>
			<div class="flex flex-1 flex-col overflow-hidden">
			<!-- Scrollable content -->
			<div class="flex-1 overflow-y-auto p-4 space-y-5">
				<div class="space-y-2">
					<p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Criador</p>
					<div class="grid grid-cols-4 gap-2">
						<button
							type="button"
							class="flex h-10 items-center justify-center rounded-lg border transition-colors {creatorMode === 'images' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'}"
							aria-label="Criar imagem"
							onclick={() => selectCreatorMode("images")}
						>
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
							</svg>
						</button>
						<button
							type="button"
							class="flex h-10 items-center justify-center rounded-lg border transition-colors {creatorMode === 'instagram' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'}"
							aria-label="Criar post para Instagram"
							onclick={() => selectCreatorMode("instagram")}
						>
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
								<rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
								<circle cx="12" cy="12" r="4.2" />
								<circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
							</svg>
						</button>
						<button
							type="button"
							class="flex h-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground/60"
							aria-label="Criar post para X (em breve)"
							onclick={() => selectCreatorMode("twitter")}
						>
							<span class="text-sm font-semibold">X</span>
						</button>
						<button
							type="button"
							class="flex h-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground/60"
							aria-label="Criar post para LinkedIn (em breve)"
							onclick={() => selectCreatorMode("linkedin")}
						>
							<span class="text-sm font-semibold">in</span>
						</button>
					</div>
				</div>

				<div class="space-y-2">
					<p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						<svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
						</svg>
						Projeto
					</p>
					<ProjectSelector
						value={selectedProjectId}
						onchange={(projectId) => (selectedProjectId = projectId)}
						description={null}
						label={null}
						compact
					/>
				</div>

				<div class="space-y-2">
					<p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						<svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
						</svg>
						Prompt
					</p>
					<Textarea
						placeholder={promptPlaceholder}
						bind:value={prompt}
						class="min-h-[72px] resize-none text-sm"
						onkeydown={(event) => {
							if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
								event.preventDefault();
								handleGenerate();
							}
						}}
					/>
				</div>

				<ReferenceImagePicker
					references={manualReferences}
					onchange={(refs) => (manualReferences = refs)}
				/>

				<ImageTemplateSection bind:selectedPreset />

				<div class="space-y-2">
					<p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						<svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
						</svg>
						Modelos de imagem
					</p>
					<ImageModelSelector
						selected={selectedModels}
						onchange={(models) => (selectedModels = models)}
						monthlyIncludedCredits={billingOverview?.usage?.monthlyIncluded ?? null}
						usageIndicatorMode="percent"
						compact
					/>
				</div>

				{#if creatorMode === "instagram"}
					<div class="space-y-2">
						<p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
							<svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
							</svg>
							Modelos de legenda
						</p>
						<CaptionModelSelector
							value={captionModel}
							onchange={(v) => (captionModel = v)}
							monthlyIncludedCredits={billingOverview?.usage?.monthlyIncluded ?? null}
							usageIndicatorMode="percent"
							compact
						/>
					</div>
				{/if}

				<div class="space-y-2">
					<p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						<svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
						</svg>
						Proporção
					</p>
					<AspectRatioSelector
						value={aspectRatio}
						onchange={(value) => (aspectRatio = value)}
						supportedValues={supportedAspectRatios}
						compact
					/>
				</div>

				<div class="space-y-2">
					<p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						<svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
						</svg>
						Resolução
					</p>
					<ResolutionSelector
						value={resolution}
						onchange={(value) => (resolution = value)}
						supportedValues={supportedResolutions}
						compact
					/>
				</div>

			</div>

			<!-- Fixed footer -->
			<div class="shrink-0 space-y-3 border-t border-border px-4 pt-4 pb-5">
				{#if errorState?.surface === "inline"}
					<div class="flex items-start gap-3 rounded-xl border border-destructive/35 bg-destructive/8 px-3 py-3 text-sm">
						<div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 6h.008v.008H12v-.008z" />
							</svg>
						</div>

						<div class="min-w-0 flex-1">
							<p class="font-medium text-destructive">{errorState.title}</p>
							<p class="mt-1 text-xs leading-5 text-muted-foreground">
								{errorState.summary}
							</p>
						</div>

						<div class="flex items-center gap-1">
							<Popover>
								<PopoverTrigger>
									<button
										type="button"
										aria-label="Ver detalhes do erro"
										class="flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-background/60 text-muted-foreground transition-colors hover:text-foreground"
									>
										<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.02M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
										</svg>
									</button>
								</PopoverTrigger>
								<PopoverContent class="w-72 space-y-2 border border-border bg-card p-4 text-sm" align="start">
									<p class="font-medium text-foreground">{errorState.title}</p>
									<p class="leading-6 text-muted-foreground">{errorState.message}</p>
								</PopoverContent>
							</Popover>

							<button
								type="button"
								aria-label="Dispensar erro"
								class="flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-background/60 text-muted-foreground transition-colors hover:text-foreground"
								onclick={clearErrorState}
							>
								<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					</div>
				{/if}

				<Button class="w-full" disabled={!prompt.trim() || isGenerating} onclick={handleGenerate}>
					{#if isGenerating}
						<svg class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						{generationLoaderLabel}
					{:else}
						<svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
						</svg>
						{generateButtonLabel}
					{/if}
				</Button>
				<p class="text-center text-xs text-muted-foreground">
					{#if !billingOverviewLoaded}
						Estimativa do plano carregando...
					{:else if planUsageEstimatePercent !== null && monthlyRemainingPercent !== null}
						Estimativa deste lote: {formatPercent(planUsageEstimatePercent)} do plano · {formatPercent(monthlyRemainingPercent)} restante
					{:else}
						Estimativa do plano indisponível no momento
					{/if}
				</p>

				<input
					bind:this={fileInputEl}
					type="file"
					accept="image/*"
					multiple
					class="hidden"
					onchange={handleUpload}
				/>
				<Button
					variant="outline"
					class="w-full"
					disabled={isUploading}
					onclick={() => fileInputEl?.click()}
				>
					{#if isUploading}
						Enviando...
					{:else}
						<svg class="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
						</svg>
						Upload
					{/if}
				</Button>
			</div>
		</div>
		</aside>

		<main class="flex flex-1 flex-col overflow-hidden">
			<div class="shrink-0 border-b border-border bg-muted/30 px-4 py-3">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="flex flex-wrap items-center gap-3">
						<Button
							variant="ghost"
							size="icon"
							onclick={() => (sidebarOpen = !sidebarOpen)}
							aria-label={sidebarOpen ? "Fechar painel lateral" : "Abrir painel lateral"}
							class="shrink-0"
						>
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75h16.5v16.5H3.75V3.75z" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.75v16.5" />
							</svg>
						</Button>
						{#if viewMode === "images"}
							<div class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
								<div class="min-w-0 flex-1">
									<LibraryFilterBar
										{projects}
										selectedProjectId={filterProjectId}
										{modelOptions}
										selectedModel={filterModel}
										sourceFilter={filterSource}
										{sortOrder}
										{galleryAssetFilter}
										{postPlatformFilter}
										{postSchedulingFilter}
										{mediaLinkFilter}
										gallerySearch={gallerySearch}
										onprojectchange={(projectId) => {
											filterProjectId = projectId as Id<"projects"> | null;
										}}
										onmodelchange={(model) => {
											filterModel = model;
										}}
										onsourcechange={(source) => {
											filterSource = source;
										}}
										onsortchange={(nextSortOrder) => {
											sortOrder = nextSortOrder;
										}}
										ongalleryassetchange={(value) => {
											galleryAssetFilter = value;
										}}
										onpostplatformchange={(value) => {
											postPlatformFilter = value;
										}}
										onpostschedulingchange={(value) => {
											postSchedulingFilter = value;
										}}
										onmedialinkchange={(value) => {
											mediaLinkFilter = value;
										}}
										ongallerysearchinput={(value) => {
											gallerySearch = value;
										}}
									/>
								</div>
								<div class="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground sm:justify-end">
									<span>
										{galleryItemCount}
										{galleryItemCount !== 1 ? " itens" : " item"}
									</span>
									{#if pendingCount > 0}
										<Badge variant="secondary" class="text-xs">{pendingCount} gerando</Badge>
									{/if}
									<Button
										type="button"
										variant={selectionMode ? "default" : "outline"}
										size="sm"
										class="h-9 gap-1.5 rounded-none"
										onclick={() => {
											if (selectionMode) {
												exitSelectionMode();
											} else {
												enterSelectionMode();
											}
										}}
									>
										{#if selectionMode}
											<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
											</svg>
											Sair da seleção
										{:else}
											<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											Selecionar
										{/if}
									</Button>
								</div>
							</div>
						{:else}
							<div>
								<p class="text-sm font-semibold text-foreground">Conversas de imagem</p>
								<p class="mt-1 text-xs text-muted-foreground">
									Continue uma edição em andamento ou retome um fio visual anterior.
								</p>
							</div>
							<span class="text-sm text-muted-foreground">
								{conversations.length} conversa{conversations.length !== 1 ? "s" : ""}
							</span>
							{#if activeConversationCount > 0}
								<Badge variant="secondary">{activeConversationCount} ativa{activeConversationCount !== 1 ? "s" : ""}</Badge>
							{/if}
						{/if}
					</div>

					<div class="flex overflow-hidden rounded-xl border border-border bg-card">
						<button
							type="button"
							class="flex h-10 w-10 items-center justify-center text-sm transition-colors {viewMode === 'images' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}"
							aria-label="Ver imagens"
							onclick={() => setViewMode("images")}
						>
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M4.75 4.75h5.5v5.5h-5.5zm9 0h5.5v5.5h-5.5zm-9 9h5.5v5.5h-5.5zm9 0h5.5v5.5h-5.5z" />
							</svg>
						</button>
					<button
						type="button"
						class="flex h-10 w-10 items-center justify-center text-sm transition-colors {viewMode === 'conversations' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}"
						aria-label="Ver conversas"
						onclick={() => setViewMode("conversations")}
						>
							<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 12h16M4 17h16" />
							</svg>
						</button>
					</div>
				</div>
			</div>

			<div class="flex-1 overflow-y-auto">
				<SignedOut>
					<div class="flex flex-1 flex-col items-center justify-center gap-6 py-20">
						<h2 class="text-2xl font-bold">Entre para ver sua galeria</h2>
						<SignInButton mode="modal">
							<button class="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
								Entrar
							</button>
						</SignInButton>
					</div>
				</SignedOut>

				<SignedIn>
					{#if viewMode === "images" && isLoading}
						<div class="flex items-center justify-center py-20">
							<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						</div>
					{:else if viewMode === "conversations" && conversationsQuery.isLoading}
						<div class="flex items-center justify-center py-20">
							<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						</div>
					{:else if viewMode === "images" && gridCards().length === 0}
						<div class="flex flex-col items-center justify-center py-20">
							<div class="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50">
								<svg class="h-10 w-10 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
								</svg>
								</div>
								<h3 class="mt-6 text-lg font-medium">
									{#if !filtersAreDefault}
										Nenhum item encontrado
									{:else}
										Sua galeria está vazia
									{/if}
								</h3>
								<p class="mt-2 text-sm text-muted-foreground">
									{#if !filtersAreDefault}
										Ajuste os filtros ou a busca para ampliar os resultados
									{:else}
										Gere imagens ao lado ou abra o editor de posts para criar conteúdo
									{/if}
							</p>
						</div>
					{:else if viewMode === "conversations" && conversations.length === 0}
						<div class="flex flex-col items-center justify-center py-20">
							<div class="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card/70 shadow-sm">
								<svg class="h-10 w-10 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
								</svg>
							</div>
							<h3 class="mt-6 text-lg font-medium">Nenhuma conversa ainda</h3>
							<p class="mt-2 text-sm text-muted-foreground">
								Abra qualquer imagem e inicie uma conversa para continuar refinando os resultados.
							</p>
						</div>
					{:else}
						<div class="p-5 sm:p-6">
							{#if viewMode === "images"}
								<div class="flex gap-5">
									{#each columnCards() as col, colIdx (colIdx)}
										<div class="flex min-w-0 flex-1 flex-col gap-5">
										{#each col as card (card.key)}
										<div class="group relative">
											{#if card.type === "item"}
												{@const mediaSelected = isMediaSelected(card.item._id)}
												<button
													type="button"
													class="w-full overflow-hidden rounded-xl border text-left shadow-sm transition {mediaSelected
														? 'border-primary bg-card ring-2 ring-primary/40'
														: 'border-border/80 bg-card/80 hover:border-border hover:bg-card'}"
													onclick={() => {
														if (selectionMode) {
															toggleMediaSelection(card.item._id);
														} else {
															openLightbox(card.item._id);
														}
													}}
													oncontextmenu={(event) => {
														event.preventDefault();
														enterSelectionMode(card.item._id);
													}}
												>
													<div class="relative overflow-hidden bg-muted" style={`aspect-ratio: ${getMediaAspectRatio(card.item)};`}>
														{#if card.item.url}
															<img
																src={card.item.thumbnailUrl ?? card.item.url}
																alt={card.item.userPrompt ?? card.item.prompt ?? "Imagem"}
																loading="lazy"
																decoding="async"
																class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
															/>
														{:else}
															<div class="flex h-full w-full items-center justify-center">
																<svg class="h-12 w-12 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
																	<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
																</svg>
															</div>
														{/if}

														{#if selectionMode}
															<div
																class="pointer-events-none absolute left-3 top-3 z-[1] flex h-7 w-7 items-center justify-center rounded-full border-2 {mediaSelected
																	? 'border-primary bg-primary text-primary-foreground shadow-[0_6px_20px_-6px_rgba(236,72,153,0.8)]'
																	: 'border-white/70 bg-black/40 text-white/0 backdrop-blur-sm'}"
															>
																{#if mediaSelected}
																	<span class="text-[11px] font-bold tabular-nums">
																		{selectionIndex(card.item._id)}
																	</span>
																{:else}
																	<svg class="h-3.5 w-3.5 opacity-0" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
																		<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
																	</svg>
																{/if}
															</div>
														{/if}

														<div class="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2 {selectionMode ? 'pl-10' : ''}">
															<div class="flex flex-wrap items-start gap-1.5">
																{#if card.item.sourceType !== "generated"}
																	<Badge variant="secondary" class="bg-black/60 text-white backdrop-blur-sm">
																		{getSourceLabel(card.item.sourceType)}
																	</Badge>
																{/if}
															</div>
															{#if (card.item.linkedPostCount ?? 0) > 0}
																<span
																	class="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary backdrop-blur-sm"
																	title="Essa imagem faz parte de {card.item.linkedPostCount} post{card.item.linkedPostCount === 1 ? '' : 's'}"
																>
																	<svg
																		class="h-3 w-3"
																		xmlns="http://www.w3.org/2000/svg"
																		fill="none"
																		viewBox="0 0 24 24"
																		stroke-width="2"
																		stroke="currentColor"
																	>
																		<path
																			stroke-linecap="round"
																			stroke-linejoin="round"
																			d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
																		/>
																	</svg>
																	{#if card.item.linkedPostCount === 1}
																		Em post
																	{:else}
																		{card.item.linkedPostCount} posts
																	{/if}
																</span>
															{/if}
														</div>
													</div>

													<div class="px-3 py-3">
														<p class="truncate text-sm font-semibold text-foreground">
															{getCardTitle(card.item)}
														</p>
														<p class="mt-1 truncate text-xs text-muted-foreground">
															{getCardMeta(card.item)}
														</p>
													</div>
												</button>

												<div class="pointer-events-none absolute inset-x-3 top-3 flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 {selectionMode ? 'hidden' : ''}">
													{#if card.item.url}
														<button
															type="button"
															aria-label="Baixar imagem"
															class="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70"
															onclick={(event) => handleDownload(card.item.url!, event)}
														>
															<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
																<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
															</svg>
														</button>
													{/if}

													<button
														type="button"
														aria-label="Excluir imagem"
														class="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-sm transition hover:bg-red-500/70"
														onclick={(event) => handleDelete(card.item._id, event)}
													>
														<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
														</svg>
													</button>
												</div>
											{:else if card.type === "post"}
												<button
													type="button"
													class="w-full overflow-hidden rounded-xl border border-border/80 bg-card/80 text-left shadow-sm transition hover:border-border hover:bg-card"
													onclick={() => openPostLightbox(card.post._id)}
												>
													<div class="relative aspect-square overflow-hidden bg-muted">
														{#if card.post.coverThumbnailUrl ?? card.post.coverUrl}
															<img
																src={card.post.coverThumbnailUrl ?? card.post.coverUrl ?? undefined}
																alt=""
																class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
																loading="lazy"
																decoding="async"
															/>
														{:else}
															<div class="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
																<svg class="h-8 w-8 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
																	<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
																</svg>
																<p class="line-clamp-4 text-xs text-muted-foreground">
																	{card.post.caption.replace(/#\S+/g, "").trim().slice(0, 140) || "Sem legenda"}
																</p>
															</div>
														{/if}
														<div class="absolute left-3 top-3 flex flex-wrap gap-1.5">
															<Badge variant="secondary" class="bg-black/60 text-white backdrop-blur-sm">Post</Badge>
															<Badge variant="secondary" class="bg-black/60 text-white backdrop-blur-sm">
																{postPlatformLabel(card.post.platform)}
															</Badge>
														</div>
														<div class="absolute right-3 top-3">
															<Badge variant="secondary" class="bg-black/60 text-white backdrop-blur-sm">
																{postSchedulingLabel(card.post.schedulingStatus)}
															</Badge>
														</div>
													</div>
													<div class="px-3 py-3">
														<p class="truncate text-sm font-semibold text-foreground">
															{card.post.title || card.post.projectName || "Sem título"}
														</p>
														<p class="mt-1 truncate text-xs text-muted-foreground">
															{formatDate(card.post.updatedAt)}
															{#if card.post.mediaCount > 0}
																{" · "}{card.post.mediaCount} mídia{card.post.mediaCount !== 1 ? "s" : ""}
															{/if}
														</p>
													</div>
												</button>
												<div class="pointer-events-none absolute inset-x-3 top-3 flex justify-end gap-2 pt-10 opacity-0 transition-opacity group-hover:opacity-100">
													<button
														type="button"
														aria-label="Excluir post"
														class="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-sm transition hover:bg-red-500/70"
														onclick={(event) => handleDeletePost(card.post._id, event)}
													>
														<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
														</svg>
													</button>
												</div>
											{:else if card.type === "conversationPending"}
												<button
													type="button"
													class="w-full overflow-hidden rounded-xl border border-dashed border-primary/30 bg-card/60 text-left shadow-sm transition hover:border-primary/50 hover:bg-card/80"
													onclick={() => openConversation(card.conversationId)}
												>
													<div class="relative bg-muted/30" style={`aspect-ratio: ${toAspectRatioValue(card.aspectRatio)};`}>
														<div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_35%),linear-gradient(to_bottom,rgba(255,255,255,0.02),rgba(255,255,255,0.06))]"></div>
														<div class="absolute left-3 top-3">
															<Badge variant="secondary" class="bg-black/55 text-white backdrop-blur-sm">
																Conversa
															</Badge>
														</div>
														<div class="relative z-[1] flex h-full w-full flex-col items-center justify-center p-2">
															<ImageGenerationPulseLoader
																message="Gerando Imagem..."
																density="compact"
															/>
														</div>
													</div>
													<div class="px-3 py-3">
														<p class="truncate text-sm font-semibold text-foreground">
															{getModelDisplayName(card.model)}
														</p>
														<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
															{card.title}
														</p>
													</div>
												</button>
											{:else}
												<div class="overflow-hidden rounded-xl border border-dashed border-primary/30 bg-card/60 shadow-sm">
													<div class="relative bg-muted/30" style={`aspect-ratio: ${toAspectRatioValue(card.aspectRatio)};`}>
														<div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_35%),linear-gradient(to_bottom,rgba(255,255,255,0.02),rgba(255,255,255,0.06))]"></div>
														<div class="relative z-[1] flex h-full w-full flex-col items-center justify-center p-2">
															<ImageGenerationPulseLoader
																message="Gerando Imagem..."
																density="compact"
															/>
														</div>
													</div>
													<div class="px-3 py-3">
														<p class="truncate text-sm font-semibold text-foreground">
															{getModelDisplayName(card.model)}
														</p>
														<p class="mt-1 truncate text-xs text-muted-foreground">
															Novo resultado em andamento
														</p>
													</div>
												</div>
											{/if}
										</div>
										{/each}
										</div>
									{/each}
								</div>

								{:else}
								<div class="mx-auto flex w-full max-w-5xl flex-col gap-5">
									{#each conversations as conversation (conversation._id)}
										<button
											type="button"
											class="group w-full rounded-[28px] border border-border bg-card/65 px-5 py-5 text-left shadow-sm transition hover:border-primary/30 hover:bg-card"
											onclick={() => openConversation(conversation._id)}
										>
											<div class="flex flex-wrap items-start justify-between gap-4">
												<div class="min-w-0">
													<div class="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
														<div class="h-2 w-2 rounded-full bg-primary"></div>
														<span>{formatRelativeTime(conversation.updatedAt)}</span>
														<span>{getConversationOutputCount(conversation)} output{getConversationOutputCount(conversation) === 1 ? "" : "s"}</span>
														{#if (conversation.latestTurn?.pendingModels?.length ?? 0) > 0}
															<span>{conversation.latestTurn?.pendingModels?.length} gerando</span>
														{/if}
													</div>
													<h3 class="mt-3 text-lg font-semibold leading-tight text-foreground">
														{getConversationTitle(conversation)}
													</h3>
													<p class="mt-1 text-sm text-muted-foreground">
														{conversation.turnCount} turno{conversation.turnCount === 1 ? "" : "s"} nesta conversa
													</p>
												</div>

												{#if conversation.sourceImageUrl}
													<div class="flex items-center gap-2 rounded-full border border-border bg-background/80 px-2 py-1.5">
														<div class="h-9 w-9 overflow-hidden rounded-lg border border-border bg-muted">
															<img src={conversation.sourceImageUrl} alt="" class="h-full w-full object-cover" />
														</div>
														<div class="text-left">
															<p class="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Source</p>
															<p class="text-xs font-medium text-foreground">Imagem base</p>
														</div>
													</div>
												{/if}
											</div>

											{#if conversation.latestTurn}
												<div class="mt-5 flex gap-4 overflow-x-auto pb-1">
													{#each conversation.latestTurn.outputs as output (output._id)}
														<div class="w-[168px] shrink-0 overflow-hidden rounded-2xl border border-border bg-background/80">
															<div class="overflow-hidden bg-muted" style={`aspect-ratio: ${output.width} / ${output.height};`}>
																{#if output.url}
																	<img src={output.thumbnailUrl ?? output.url} alt={getModelDisplayName(output.model)} loading="lazy" decoding="async" class="h-full w-full object-cover" />
																{/if}
															</div>
															<div class="px-3 py-3">
																<p class="truncate text-sm font-medium text-foreground">{getModelDisplayName(output.model)}</p>
															</div>
														</div>
													{/each}

													{#each conversation.latestTurn.pendingModels ?? [] as pendingModel (pendingModel)}
														<div class="w-[168px] shrink-0 overflow-hidden rounded-2xl border border-border bg-background/80">
															<ImageSkeleton model={pendingModel} aspectRatio={conversation.latestTurn.aspectRatio} />
															<div class="px-3 py-3">
																<p class="truncate text-sm font-medium text-foreground">{getModelDisplayName(pendingModel)}</p>
															</div>
														</div>
													{/each}
												</div>
											{/if}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</SignedIn>
			</div>
		</main>
	</div>
</div>

{#if selectionMode && selectedMediaIds.length > 0}
	<div class="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
		<div
			class="pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-border bg-background/95 px-4 py-3 shadow-2xl backdrop-blur-md"
			role="region"
			aria-label="Ações em seleção de mídia"
		>
			<div class="flex items-center gap-2.5">
				<span class="flex h-8 w-8 items-center justify-center rounded-full {selectionOverLimit ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'} text-[13px] font-bold tabular-nums">
					{selectedMediaIds.length}
				</span>
				<p class="text-sm font-medium text-foreground">
					{selectedMediaIds.length === 1 ? "1 imagem selecionada" : `${selectedMediaIds.length} imagens selecionadas`}
				</p>
				{#if selectionOverLimit}
					<Badge variant="secondary" class="border-destructive/40 bg-destructive/10 text-destructive">
						Máx {INSTAGRAM_CAROUSEL_MAX} no Instagram
					</Badge>
				{/if}
			</div>
			<div class="ml-auto flex items-center gap-2">
				<span
					title={selectionOverLimit
						? `Instagram permite no máximo ${INSTAGRAM_CAROUSEL_MAX} mídias por carrossel. Remova ${selectedMediaIds.length - INSTAGRAM_CAROUSEL_MAX} para continuar.`
						: ""}
				>
					<Button
						type="button"
						variant="outline"
						size="sm"
						class="h-9 gap-1.5"
						onclick={createPostFromSelection}
						disabled={isBulkSaving || selectedMediaIds.length === 0 || selectionOverLimit}
					>
						<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
						</svg>
						Criar post
					</Button>
				</span>
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="h-9 gap-1.5"
					onclick={() => (addToPostOpen = true)}
					disabled={isBulkSaving || selectedMediaIds.length === 0}
				>
					<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
					</svg>
					Adicionar a post
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="h-9 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
					onclick={deleteSelection}
					disabled={isBulkSaving}
				>
					<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
					</svg>
					Excluir
				</Button>
				<div class="mx-1 h-6 w-px bg-border"></div>
				<Button type="button" variant="ghost" size="sm" class="h-9" onclick={exitSelectionMode} disabled={isBulkSaving}>
					Cancelar
				</Button>
			</div>
		</div>
	</div>
{/if}

<AddToPostDialog
	open={addToPostOpen}
	mediaCount={selectedMediaIds.length}
	onclose={() => (addToPostOpen = false)}
	onselect={appendSelectionToPost}
/>

<ImageGenerationErrorModal error={errorState} onclose={clearErrorState} />

{#if viewMode === "images" && lightboxOpen && lightboxMediaId && lightboxItems.length > 0}
	<MediaLightbox
		items={lightboxItems}
		currentMediaId={lightboxMediaId}
		onclose={closeLightbox}
		onnavigate={navigateLightbox}
		onopenpost={openPostLightbox}
		overrideCounterText={galleryCounterText}
		overrideCanPrev={galleryCanPrev}
		overrideCanNext={galleryCanNext}
		onprevglobal={navigateGalleryPrev}
		onnextglobal={navigateGalleryNext}
	/>
{/if}

{#if viewMode === "images" && postLightboxOpen && lightboxPostId && postLightboxNavItems.some((p) => p._id === lightboxPostId)}
	<PostLightbox
		items={postLightboxNavItems}
		currentPostId={lightboxPostId}
		onclose={closePostLightbox}
		onnavigate={navigatePostLightbox}
		onopenmedia={openLightbox}
		overrideCounterText={galleryCounterText}
		overrideCanPrev={galleryCanPrev}
		overrideCanNext={galleryCanNext}
		onprevglobal={navigateGalleryPrev}
		onnextglobal={navigateGalleryNext}
	/>
{/if}
