/**
 * HTTP layer of the MILES API.
 *
 * Responsibilities:
 * - refuse to pretend a backend exists when none is configured;
 * - bound every request with a timeout;
 * - translate network failures into typed, explainable errors;
 * - validate payloads before they reach the UI (zod schemas live in schema.ts).
 *
 * Cookies are sent (`credentials: "include"`) so a session-based backend auth
 * works without ever putting a secret in the frontend.
 */

import {
  API_ENDPOINTS,
  IS_BACKEND_CONFIGURED,
  MILES_API_BASE_URL,
  REQUEST_TIMEOUT_MS,
} from "@/config/app";

export type MilesErrorCode =
  | "not_configured"
  | "network"
  | "timeout"
  | "http"
  | "parse";

export class MilesApiError extends Error {
  readonly code: MilesErrorCode;
  readonly status?: number;
  readonly path?: string;

  constructor(
    code: MilesErrorCode,
    message: string,
    options: { status?: number; path?: string } = {},
  ) {
    super(message);
    this.name = "MilesApiError";
    this.code = code;
    this.status = options.status;
    this.path = options.path;
  }
}

export function isMilesApiError(error: unknown): error is MilesApiError {
  return error instanceof MilesApiError;
}

/** Human readable, non-technical explanation of any error. */
export function describeError(error: unknown): string {
  if (isMilesApiError(error)) {
    switch (error.code) {
      case "not_configured":
        return "Aucun backend MILES n'est configuré (variable VITE_MILES_API_BASE_URL).";
      case "timeout":
        return "Le backend n'a pas répondu dans le délai imparti.";
      case "network":
        return "Impossible de joindre le backend : réseau indisponible ou service arrêté.";
      case "http":
        return `Le backend a répondu en erreur (HTTP ${error.status ?? "?"}).`;
      case "parse":
        return "Réponse du backend invalide : le contrat d'API n'est pas respecté.";
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "Erreur inconnue.";
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Perform a validated JSON request against the MILES backend.
 *
 * @param validate maps/validates the raw payload; it MUST throw (zod does)
 *                 when the payload does not match the documented contract.
 */
export async function requestBackend<T>(
  path: string,
  options: RequestOptions,
  validate: (data: unknown) => T,
): Promise<T> {
  if (!IS_BACKEND_CONFIGURED) {
    throw new MilesApiError(
      "not_configured",
      `Backend non configuré (endpoint ${path})`,
      { path },
    );
  }

  const url = `${MILES_API_BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(new DOMException("timeout", "AbortError")), timeoutMs);
  const onExternalAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", onExternalAbort);

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      credentials: "include",
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new MilesApiError(
        "http",
        `${options.method ?? "GET"} ${path} → HTTP ${response.status}`,
        { status: response.status, path },
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new MilesApiError("parse", `${path} : réponse non-JSON`, { path });
    }

    try {
      return validate(payload);
    } catch (error) {
      if (error instanceof MilesApiError) throw error;
      throw new MilesApiError(
        "parse",
        `${path} : ${error instanceof Error ? error.message : "schéma invalide"}`,
        { path },
      );
    }
  } catch (error) {
    if (error instanceof MilesApiError) throw error;
    if (
      error instanceof DOMException &&
      error.name === "AbortError" &&
      !options.signal?.aborted
    ) {
      throw new MilesApiError("timeout", `${path} : délai dépassé`, { path });
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new MilesApiError(
      "network",
      `${path} : ${error instanceof Error ? error.message : "erreur réseau"}`,
      { path },
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}

/** Build `?a=1&b=2`, skipping undefined values. */
export function withQuery(
  path: string,
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export { API_ENDPOINTS };
