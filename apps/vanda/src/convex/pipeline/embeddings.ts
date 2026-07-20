import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";

export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

const EmbeddingResponse = Schema.Struct({
  data: Schema.Array(
    Schema.Struct({
      index: Schema.Number,
      embedding: Schema.Array(Schema.Number),
    }),
  ),
});

export class EmbeddingFailed extends Data.TaggedError("EmbeddingFailed")<{
  readonly message: string;
}> {}

export interface EmbeddingsShape {
  readonly embed: (
    texts: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<ReadonlyArray<number>>, EmbeddingFailed>;
}

export class Embeddings extends Context.Service<Embeddings, EmbeddingsShape>()(
  "@vanda/pipeline/Embeddings",
) {}

export const embeddingsLive = (apiKey: string): Layer.Layer<Embeddings> =>
  Layer.effect(
    Embeddings,
    Effect.gen(function* () {
      const baseClient = yield* HttpClient.HttpClient;
      const client = baseClient.pipe(HttpClient.filterStatusOk);
      return {
        embed: (texts) =>
          texts.length === 0
            ? Effect.succeed([])
            : HttpClientRequest.post("https://openrouter.ai/api/v1/embeddings").pipe(
                HttpClientRequest.setHeader("Authorization", `Bearer ${apiKey}`),
                HttpClientRequest.bodyJson({
                  model: EMBEDDING_MODEL,
                  dimensions: EMBEDDING_DIMENSIONS,
                  input: texts,
                }),
                Effect.flatMap(client.execute),
                Effect.flatMap(HttpClientResponse.schemaBodyJson(EmbeddingResponse)),
                Effect.map((response) =>
                  [...response.data]
                    .sort((a, b) => a.index - b.index)
                    .map((entry) => entry.embedding),
                ),
                Effect.filterOrFail(
                  (vectors) =>
                    vectors.length === texts.length &&
                    vectors.every((vector) => vector.length === EMBEDDING_DIMENSIONS),
                  () => new EmbeddingFailed({ message: "resposta de embeddings incompleta" }),
                ),
                Effect.mapError((error) =>
                  error instanceof EmbeddingFailed
                    ? error
                    : new EmbeddingFailed({ message: String(error) }),
                ),
              ),
      } satisfies EmbeddingsShape;
    }),
  ).pipe(Layer.provide(FetchHttpClient.layer));
