"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "./analytics-api";

export function useData<T>(
  path: string | null,
  token: string,
  keepPreviousData = false,
) {
  const [result, setResult] = useState<{
    path: string;
    token: string;
    data?: T;
    error?: string;
  }>();

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    fetchApi<T>(path, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    }).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ path, token, data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({
            path,
            token,
            error:
              error instanceof Error
                ? error.message
                : "Не удалось загрузить данные.",
          });
        }
      },
    );
    return () => controller.abort();
  }, [path, token]);

  const sameSession = result?.token === token;
  const current = sameSession && result?.path === path;
  const loading = path !== null && !current;

  return {
    data:
      current || (loading && sameSession && keepPreviousData)
        ? result?.data
        : undefined,
    error: current ? result?.error : undefined,
    loading,
  };
}
