import { describe, expect, it } from "vitest";
import {
    getImageModelDisplayName,
    getMediaSourceLabel,
    normalizeSearchText,
    rankSearchMatch,
} from "./search";

describe("search helpers", () => {
    it("normalizes accents, punctuation, and case", () => {
        expect(normalizeSearchText("  Amazônia Néctar!!!  ")).toBe("amazonia nectar");
    });

    it("matches post titles using tokenized search", () => {
        const match = rankSearchMatch("how we", [
            { value: "how we doing today?", weight: 12 },
            { value: "caption that does not matter here", weight: 6 },
        ]);

        expect(match).not.toBeNull();
        expect(match?.score).toBeGreaterThan(0);
    });

    it("matches regardless of token order", () => {
        const match = rankSearchMatch("banana nano 2", [
            { value: "Nano Banana 2", weight: 10 },
        ]);

        expect(match).not.toBeNull();
    });

    it("supports human-readable model aliases", () => {
        expect(getImageModelDisplayName("google/gemini-3.1-flash-image-preview")).toBe("Nano Banana 2");

        const match = rankSearchMatch("nano banana 2", [
            { value: getImageModelDisplayName("google/gemini-3.1-flash-image-preview"), weight: 10 },
            { value: "google/gemini-3.1-flash-image-preview", weight: 4 },
        ]);

        expect(match).not.toBeNull();
    });

    it("matches localized source labels", () => {
        expect(getMediaSourceLabel("uploaded")).toBe("Upload manual");

        const match = rankSearchMatch("upload manual", [
            { value: getMediaSourceLabel("uploaded"), weight: 5 },
        ]);

        expect(match).not.toBeNull();
    });

    it("rejects partial token coverage", () => {
        const match = rankSearchMatch("nano banana 2", [
            { value: "Nano Banana Pro", weight: 10 },
        ]);

        expect(match).toBeNull();
    });

    it("does not stitch tokens across unrelated fields", () => {
        const match = rankSearchMatch("nano banana pro", [
            { value: "Nano Banana 2", weight: 10 },
            { value: "professional cat portrait", weight: 6 },
        ]);

        expect(match).toBeNull();
    });
});
