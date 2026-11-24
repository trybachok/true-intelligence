"use client";

import { useState } from "react";

export default function Home() {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function checkConnection() {
    setStatus("loading");
    try {
      const response = await fetch("/api/health", {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      setStatus(response.ok ? "ok" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Истинный интеллект</h1>
      <button
        type="button"
        onClick={checkConnection}
        disabled={status === "loading"}
        className="mt-6 rounded-md bg-blue-700 px-4 py-2 text-white disabled:opacity-60"
      >
        Проверить подключение
      </button>
      <p className="mt-3" role="status">
        {status === "loading" && "Проверяем подключение…"}
        {status === "ok" && "PostgreSQL доступен."}
        {status === "error" && "Не удалось подтвердить подключение к PostgreSQL."}
      </p>
    </main>
  );
}
