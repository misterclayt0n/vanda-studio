import * as Effect from "effect/Effect";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import type { modelStages } from "./constants";

type ModelStage = (typeof modelStages)[number];

interface RunMetadata {
  readonly accountId: Id<"accounts">;
  readonly stage: ModelStage;
  readonly model: string;
  readonly promptVersion: string;
  readonly inputIds: ReadonlyArray<string>;
}

export const runTracked = async <A>(
  ctx: ActionCtx,
  metadata: RunMetadata,
  run: () => Promise<A>,
  summarize: (value: A) => string,
): Promise<A> => {
  return Effect.runPromise(
    Effect.tryPromise(() =>
      ctx.runMutation(internal.modelTelemetry.start, {
        ...metadata,
        inputIds: [...metadata.inputIds],
      }),
    ).pipe(
      Effect.flatMap((runId) =>
        Effect.tryPromise(run).pipe(
          Effect.tap((value) =>
            Effect.tryPromise(() =>
              ctx.runMutation(internal.modelTelemetry.finish, {
                runId,
                status: "succeeded",
                outputSummary: summarize(value),
              }),
            ),
          ),
          Effect.tapError((error) =>
            Effect.tryPromise(() =>
              ctx.runMutation(internal.modelTelemetry.finish, {
                runId,
                status: "failed",
                error: error instanceof Error ? error.message : String(error),
              }),
            ).pipe(Effect.ignore),
          ),
        ),
      ),
    ),
  );
};
