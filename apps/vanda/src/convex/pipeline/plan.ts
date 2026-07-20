import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import { isThemeSaturated, meetsEvidenceThreshold } from "./discernment";
import { BrandContext, renderBrandContext } from "./brandContext";
import {
  type AccountMode,
  type Belief,
  PostType,
  type Suggestion,
  type SuggestionStatus,
  type Theme,
} from "./memory";
import { Memory, type MemorySnapshot } from "./memoryStore";
import { type PlanResult, Suggestions } from "./suggestions";

/** A candidate post idea the model proposes, grounded in held beliefs. */
export const Idea = Schema.Struct({
  title: Schema.String,
  /** A format hint; plan is format-agnostic (create decides), so the model may omit it. */
  format: Schema.optionalKey(PostType),
  themeName: Schema.String,
  /** The EXACT statements of the held beliefs this idea draws on (its provenance). */
  beliefStatements: Schema.Array(Schema.String),
  /** Stable belief identities; legacy/test ideas may omit and fall back to statements. */
  beliefKeys: Schema.optionalKey(Schema.Array(Schema.String)),
  rationale: Schema.String,
});
export type Idea = typeof Idea.Type;

/** The ideate phase output (generateObject yields one object, so ideas are wrapped). */
export const Ideas = Schema.Struct({ ideas: Schema.Array(Idea) });

/** The critique phase's skeptical verdict on one idea, judged in fresh context. */
export const Critique = Schema.Struct({
  verdict: Schema.Literals(["accept", "reject"]),
  reason: Schema.String,
  /** Touches negative sentiment / a competitor / other risk → needs human approval. */
  sensitive: Schema.Boolean,
});
export type Critique = typeof Critique.Type;

const PLAN_CONCURRENCY = 4;

const normalize = (statement: string): string => statement.trim().toLowerCase();

const fmtPct = (n: number): string => `${Math.round(n * 100)}%`;

const ideatePrompt = (
  beliefs: ReadonlyArray<Belief>,
  themes: ReadonlyArray<Theme>,
  brandContext: string,
): string => {
  const beliefLines = beliefs
    .map(
      (b, index) =>
        `- [${b.key ?? `legacy:${index}`}] [${b.kind}] ${b.statement} ` +
        `(confiança ${fmtPct(b.confidence)})`,
    )
    .join("\n");
  const themeLines =
    themes.length === 0 ? "(none)" : themes.map((t) => `- ${t.name} (${t.momentum})`).join("\n");
  return (
    `Você é a estrategista de redes sociais de uma marca. A partir das crenças bem ` +
    `fundamentadas abaixo, proponha até 3 ideias concretas de posts para Instagram. ` +
    `Fundamente cada ideia em uma ou mais crenças listadas, copiando suas chaves em ` +
    `beliefKeys e seu texto em beliefStatements. Escolha um formato (feed, reel, story, tweet ou ` +
    `image), informe o tema e dê uma justificativa em uma frase. Escreva todo o ` +
    `conteúdo em português do Brasil e não proponha nada sem apoio nas crenças.\n\n` +
    `Contexto confirmado da marca:\n${brandContext || "(não informado)"}\n\n` +
    `Crenças:\n${beliefLines}\n\nTemas:\n${themeLines}`
  );
};

const critiquePrompt = (idea: Idea, brandContext: string): string =>
  `Você é uma editora criteriosa revisando UMA proposta de post para Instagram de um ` +
  `pequeno negócio. Rejeite se for genérica, sem evidência, arriscada ou desalinhada ` +
  `com a marca; aceite somente se for específica e claramente valer a publicação. ` +
  `Marque sensitive quando envolver sentimento negativo, concorrentes ou decisão do dono. ` +
  `Responda em português do Brasil.\n\nContexto confirmado da marca:\n` +
  `${brandContext || "(não informado)"}\n\nTítulo: ${idea.title}\nTema: ${idea.themeName}\n` +
  `Justificativa: ${idea.rationale}`;

// --- Pure deliberation helpers --------------------------------------------

/** The held beliefs an idea names (by exact, normalized statement). */
const citedBeliefs = (idea: Idea, snapshot: MemorySnapshot): ReadonlyArray<Belief> =>
  (idea.beliefKeys ?? idea.beliefStatements)
    .map((reference) =>
      idea.beliefKeys !== undefined
        ? snapshot.beliefs.find((belief) => belief.key === reference)
        : snapshot.beliefs.find((belief) => normalize(belief.statement) === normalize(reference)),
    )
    .filter((b): b is Belief => b !== undefined);

const provenanceSignals = (cited: ReadonlyArray<Belief>): ReadonlyArray<string> => [
  ...new Set(cited.flatMap((b) => b.supportingSignalIds)),
];

/**
 * The deterministic playbook gate, run before spending a critique call: an idea
 * must be grounded in an actionable belief and its theme must not be saturated.
 * Returns a rejection reason, or `undefined` when the idea passes.
 */
const gateIdea = (idea: Idea, snapshot: MemorySnapshot, now: number): string | undefined => {
  const cited = citedBeliefs(idea, snapshot);
  if (cited.length === 0) return "not grounded in any held belief";
  if (!cited.some((b) => meetsEvidenceThreshold(b, snapshot.policy)))
    return "grounding beliefs are below the evidence threshold";
  const theme = snapshot.themes.find((t) => normalize(t.name) === normalize(idea.themeName));
  if (theme !== undefined && isThemeSaturated(theme, now, snapshot.policy))
    return `theme "${theme.name}" was posted within the cadence window`;
  return undefined;
};

/** Initial control status from the account mode + the critique's sensitivity flag. */
const controlStatus = (
  mode: AccountMode,
  sensitive: boolean,
): { readonly status: SuggestionStatus; readonly requiresApproval: boolean } => {
  const requiresApproval = sensitive || mode === "needs_approval";
  const status: SuggestionStatus = requiresApproval
    ? "needs_you"
    : mode === "auto"
      ? "approved"
      : "suggestion";
  return { status, requiresApproval };
};

/** The fields every suggestion shares; the model's format hint is carried only when present. */
const baseSuggestion = (
  idea: Idea,
  snapshot: MemorySnapshot,
  accountId: string,
  now: number,
): Omit<Suggestion, "status" | "requiresApproval" | "rejectionReason"> => {
  const base = {
    accountId,
    title: idea.title,
    rationale: idea.rationale,
    themeName: idea.themeName,
    beliefStatements: idea.beliefStatements,
    ...(idea.beliefKeys !== undefined ? { beliefKeys: idea.beliefKeys } : {}),
    signalIds: provenanceSignals(citedBeliefs(idea, snapshot)),
    createdAt: now,
  };
  return idea.format === undefined ? base : { ...base, format: idea.format };
};

const acceptedSuggestion = (
  idea: Idea,
  snapshot: MemorySnapshot,
  accountId: string,
  sensitive: boolean,
  now: number,
): Suggestion => ({
  ...baseSuggestion(idea, snapshot, accountId, now),
  ...controlStatus(snapshot.mode, sensitive),
});

const rejectedSuggestion = (
  idea: Idea,
  snapshot: MemorySnapshot,
  accountId: string,
  reason: string,
  now: number,
): Suggestion => ({
  ...baseSuggestion(idea, snapshot, accountId, now),
  status: "rejected",
  requiresApproval: false,
  rejectionReason: reason,
});

/**
 * The plan stage: deliberate over consolidated memory. Generate candidate ideas
 * from the well-evidenced beliefs (ideate), drop any that fail the deterministic
 * playbook gate, then put each survivor through a separate skeptical critique (so
 * the model isn't rationalizing its own ideas). Accepted ideas become suggestions
 * with a control status; rejected candidates are kept with a reason. Plan never
 * publishes — it only proposes.
 */
export const plan = Effect.fn("pipeline.plan")(function* (accountId: string) {
  const memory = yield* Memory;
  const brands = yield* BrandContext;
  const suggestions = yield* Suggestions;
  const snapshot = yield* memory.loadSnapshot(accountId);
  const brand = yield* brands.load(accountId);
  const brandPrompt = renderBrandContext(brand);
  const now = yield* Clock.currentTimeMillis;
  const actionable = snapshot.beliefs.filter((b) => meetsEvidenceThreshold(b, snapshot.policy));

  let drafts: ReadonlyArray<Suggestion> = [];
  if (actionable.length > 0) {
    const ideated = yield* LanguageModel.generateObject({
      prompt: ideatePrompt(actionable, snapshot.themes, brandPrompt),
      schema: Ideas,
    });
    drafts = yield* Effect.forEach(
      ideated.value.ideas,
      (idea) =>
        Effect.gen(function* () {
          const rejection = gateIdea(idea, snapshot, now);
          if (rejection !== undefined)
            return rejectedSuggestion(idea, snapshot, accountId, rejection, now);
          const critique = yield* LanguageModel.generateObject({
            prompt: critiquePrompt(idea, brandPrompt),
            schema: Critique,
          });
          return critique.value.verdict === "reject"
            ? rejectedSuggestion(idea, snapshot, accountId, critique.value.reason, now)
            : acceptedSuggestion(idea, snapshot, accountId, critique.value.sensitive, now);
        }),
      { concurrency: PLAN_CONCURRENCY },
    );
  }

  const result: PlanResult = { suggestions: drafts };
  yield* suggestions.save(accountId, result);
  return result;
});
