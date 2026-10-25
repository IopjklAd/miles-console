/**
 * AI configuration shared by the mutation that schedules a reply and the
 * Node action that calls the provider.
 *
 * No secret lives here: keys stay in the deployment environment and are read
 * by the action only (`src/convex/ai.ts`).
 */

/** Models documented by the integration gateway (see integrations.md). */
export const AI_MODELS = ["gpt-4o-mini", "gpt-4o"];

export const DEFAULT_AI_MODEL = "gpt-4o-mini";

/** Reject anything that is not part of the documented model list. */
export function isAllowedModel(model: string | undefined): boolean {
  return !!model && AI_MODELS.includes(model);
}

/** Reply limit. Keeps a long conversation inside one request. */
export const MAX_TOKENS = 900;

export const TEMPERATURE = 0.4;

/** How many previous messages are sent to the provider. */
export const MAX_CONTEXT_MESSAGES = 20;

export const MAX_MESSAGE_LENGTH = 4_000;

export const DEFAULT_TITLE = "Nouvelle conversation";

export const AI_SYSTEM_PROMPT = [
  "Tu es l'assistant technique de MILES, un système robotique basé sur une carte ESP32-S3,",
  "des capteurs (PIR, sonore, VL53L3CX), une webcam, une interface audio et un orchestrateur logiciel.",
  "Tu réponds en français, de façon concise et factuelle.",
  "Tu peux commenter l'état du système, la supervision, les journaux et le code de la console MILES.",
  "Si une information matérielle ou backend ne t'est pas fournie, dis-le explicitement au lieu de l'inventer.",
  "Réponds avec du Markdown sobre : listes, **gras**, `code` et blocs de code entre ```.",
].join(" ");

/** Remove anything that looks like a credential from provider messages. */
export function sanitizeError(message: string): string {
  return message
    .replace(/\b(sk|pk|api)[-_][A-Za-z0-9_-]{6,}\b/g, "[identifiant masqué]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[jeton masqué]")
    .slice(0, 400);
}
