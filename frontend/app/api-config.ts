import type { CreateClientConfig } from "./api-client/client.gen";

export const createClientConfig: CreateClientConfig = (defaults) => ({
  ...defaults,
  baseUrl: typeof window === "undefined" ? undefined : window.location.origin,
  cache: "no-store",
});

export function apiErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "UNAUTHENTICATED"
  ) {
    return "Срок входа истёк. Войдите снова.";
  }

  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "Сервер не ответил вовремя.";
  }

  if (error instanceof TypeError) {
    return "Не удалось связаться с сервером.";
  }

  if (
    typeof error === "object" &&
    error !== null &&
    !(error instanceof Error) &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Не удалось получить ответ сервера.";
}
