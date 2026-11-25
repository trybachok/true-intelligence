"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { apiErrorMessage } from "./api-config";

type RequestOptions = {
  auth: string;
  signal: AbortSignal;
  throwOnError: true;
};

export function useData<T>(
  key: string | number | null,
  token: string,
  load: (options: RequestOptions) => Promise<{ data: T }>,
  keepPreviousData = false,
) {
  const [result, setResult] = useState<{
    key: string | number;
    token: string;
    data?: T;
    error?: string;
  }>();

  const loadData = useEffectEvent(load);

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    loadData({
      auth: token,
      throwOnError: true,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    }).then(
      ({ data }) => {
        if (!controller.signal.aborted) setResult({ key, token, data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({
            key,
            token,
            error: apiErrorMessage(error),
          });
        }
      },
    );
    return () => controller.abort();
  }, [key, token]);

  const sameSession = result?.token === token;
  const current = sameSession && result?.key === key;
  const loading = key !== null && !current;

  return {
    data:
      current || (loading && sameSession && keepPreviousData)
        ? result?.data
        : undefined,
    error: current ? result?.error : undefined,
    loading,
  };
}
