import { ConvexError } from "convex/values";
import {
	createImageGenerationUiError,
	isImageGenerationErrorPayload,
	type ImageGenerationErrorCode,
	type ImageGenerationErrorPayload,
} from "../lib/studio/imageGenerationErrors";

export function createImageGenerationError(
	code: ImageGenerationErrorCode,
	overrides: Partial<Omit<ImageGenerationErrorPayload, "domain" | "code">> = {}
): ImageGenerationErrorPayload {
	const error = createImageGenerationUiError(code, overrides);
	return {
		domain: error.domain,
		code: error.code,
		title: error.title,
		message: error.message,
		...(error.action ? { action: error.action } : {}),
	};
}

export function throwImageGenerationError(
	code: ImageGenerationErrorCode,
	overrides: Partial<Omit<ImageGenerationErrorPayload, "domain" | "code">> = {}
): never {
	throw new ConvexError(createImageGenerationError(code, overrides));
}

export function getImageGenerationErrorPayload(
	error: unknown
): ImageGenerationErrorPayload | null {
	if (error && typeof error === "object" && "data" in error) {
		const data = (error as { data?: unknown }).data;
		if (isImageGenerationErrorPayload(data)) {
			return data;
		}
	}

	if (isImageGenerationErrorPayload(error)) {
		return error;
	}

	return null;
}

export function getStoredImageGenerationError(
	error: unknown,
	fallbackCode: ImageGenerationErrorCode = "GENERATION_FAILED"
): { code: ImageGenerationErrorCode; message: string } {
	const payload = getImageGenerationErrorPayload(error);
	if (payload) {
		return {
			code: payload.code,
			message: payload.message,
		};
	}

	if (
		error &&
		typeof error === "object" &&
		"errorMessage" in error &&
		typeof (error as { errorMessage?: unknown }).errorMessage === "string"
	) {
		return {
			code: fallbackCode,
			message: (error as { errorMessage: string }).errorMessage,
		};
	}

	const fallback = createImageGenerationError(fallbackCode);
	return {
		code: fallback.code,
		message: fallback.message,
	};
}
