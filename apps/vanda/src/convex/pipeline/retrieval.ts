import type * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

/**
 * A context bundle for grounding create's caption + image prompts: the most
 * relevant brand-knowledge snippets (beliefs the account holds) plus the theme
 * the suggestion belongs to. This is the "retrieval" half of RAG — what create
 * feeds the model alongside the suggestion it is composing.
 */
export interface ContextBundle {
  /** Owner-confirmed facts and restrictions that must never be retrieval-optional. */
  readonly critical: ReadonlyArray<string>;
  /** Retrieved brand-knowledge snippets, most-relevant first. */
  readonly snippets: ReadonlyArray<string>;
  /** Summary of the theme the suggestion belongs to ("" when unknown). */
  readonly themeSummary: string;
  /** Owner-uploaded visual references that creation must preserve when relevant. */
  readonly referenceImageUrls?: ReadonlyArray<string>;
}

/**
 * Retrieval-Augmented Generation port: fetch the brand context most relevant to
 * a query (the suggestion's title + theme). The live layer ranks the account's
 * beliefs lexically; a vector index (embeddings) is the documented scale path —
 * swap the layer, nothing downstream changes. Tests provide a fixed bundle.
 */
export interface RetrievalShape {
  readonly retrieve: (
    accountId: string,
    query: string,
  ) => Effect.Effect<ContextBundle, Cause.UnknownError>;
}

export class Retrieval extends Context.Service<Retrieval, RetrievalShape>()(
  "@vanda/pipeline/Retrieval",
) {}

// --- Pure lexical ranking -------------------------------------------------

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "our",
  "you",
  "your",
  "with",
  "this",
  "that",
  "from",
  "have",
  "has",
  "uma",
  "para",
  "com",
  "que",
  "por",
  "dos",
  "das",
  "seu",
  "sua",
]);

/** Lowercase, split on non-word chars, drop short/stop tokens. */
export const tokenize = (text: string): ReadonlyArray<string> =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

/**
 * Lexical relevance of a candidate to a query: the fraction of distinct query
 * terms that appear in the candidate (term overlap), in [0, 1]. An empty query
 * scores nothing — there is no signal to rank on.
 */
export const relevanceScore = (query: string, candidate: string): number => {
  const queryTerms = new Set(tokenize(query));
  if (queryTerms.size === 0) return 0;
  const candidateTerms = new Set(tokenize(candidate));
  let hits = 0;
  for (const term of queryTerms) if (candidateTerms.has(term)) hits++;
  return hits / queryTerms.size;
};

/**
 * Rank candidates by relevance to the query, most-relevant first, keeping the
 * top `k` with any overlap. Ties preserve input order (stable), so ranking is
 * deterministic — the same corpus always retrieves the same bundle.
 */
export const rankByRelevance = (
  query: string,
  candidates: ReadonlyArray<string>,
  k: number,
): ReadonlyArray<string> =>
  candidates
    .map((candidate, index) => ({ candidate, score: relevanceScore(query, candidate), index }))
    .filter((scored) => scored.score > 0)
    // oxlint-disable-next-line no-array-sort -- sorting a freshly mapped/filtered array
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, k))
    .map((scored) => scored.candidate);

/** How many brand-knowledge snippets to retrieve into a bundle. */
export const TOP_K = 5;

/**
 * Build a context bundle from a corpus of brand-knowledge statements: keep the
 * top-K most relevant to the query. Pure — the live layer supplies the corpus
 * (the account's beliefs) from Convex; the test layer can call this directly.
 */
export const buildBundle = (
  query: string,
  corpus: ReadonlyArray<string>,
  themeSummary: string,
  critical: ReadonlyArray<string> = [],
  referenceImageUrls: ReadonlyArray<string> = [],
): ContextBundle => ({
  critical,
  snippets: rankByRelevance(query, corpus, TOP_K),
  themeSummary,
  referenceImageUrls,
});
