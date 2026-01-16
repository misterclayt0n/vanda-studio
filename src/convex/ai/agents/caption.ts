import { Effect } from "effect";
import { TextGeneration, MODELS, runAiEffectOrThrow } from "../llm/index";

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `Voce e um assistente especialista em criar legendas para Instagram em portugues brasileiro.

Sua tarefa e ajudar o usuario a criar e refinar legendas. Voce pode:
- Criar legendas do zero baseado em instrucoes
- Modificar legendas existentes baseado em feedback
- Ajustar tom, tamanho, hashtags conforme solicitado

## Diretrizes
- Escreva em portugues brasileiro natural e fluente
- Use emojis de forma organica quando apropriado
- Crie conexao emocional com o publico
- Seja autentico, nunca generico ou robotico
- Seja conciso nas explicacoes

## Formato de Resposta
Responda APENAS com JSON valido:
{
  "caption": "a legenda completa aqui",
  "explanation": "breve explicacao do que foi feito (1-2 frases)"
}`;

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface CaptionInput {
    /** Full conversation history for context */
    conversationHistory: ChatMessage[];
    /** Current caption if refining (included in context) */
    currentCaption?: string;
    /** The new user message/instruction */
    userMessage: string;
    /** Reference text from Instagram posts, articles, etc. */
    referenceText?: string;
    /** Model to use for caption generation */
    model?: string;
}

export interface CaptionOutput {
    caption: string;
    explanation: string;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Generate or refine a caption based on conversation context
 */
export async function generateCaption(input: CaptionInput): Promise<CaptionOutput> {
    // Build messages array for the LLM
    const messages: ChatMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add conversation history (excluding system messages, we have our own)
    for (const msg of input.conversationHistory) {
        if (msg.role !== "system") {
            messages.push(msg);
        }
    }

    // Build the current user message with context
    let userPrompt = input.userMessage;

    if (input.currentCaption) {
        userPrompt = `## Legenda Atual
"${input.currentCaption}"

## Instrucao do Usuario
${input.userMessage}`;
    }

    const referenceText = input.referenceText;
    if (referenceText) {
        userPrompt += `\n\n## Material de Referencia\n"${referenceText}"`;
    }

    messages.push({ role: "user", content: userPrompt });

    // Call the LLM
    const result = await runAiEffectOrThrow(
        Effect.gen(function* () {
            const textGen = yield* TextGeneration;
            return yield* textGen.generateCaption({
                messages,
                model: input.model ?? MODELS.GPT_4_1,
                temperature: 0.8,
                maxTokens: 1024,
            });
        })
    );

    return {
        caption: result.caption,
        explanation: result.reasoning,
    };
}
