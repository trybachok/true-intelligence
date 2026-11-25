"use client";

import { type FormEvent, useState } from "react";
import { Dashboard } from "./dashboard";
import { fetchApi, type Session } from "./analytics-api";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const fields = new FormData(event.currentTarget);
    setLoading(true);
    setError("");
    try {
      const session = await fetchApi<Session>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: fields.get("email"),
          password: fields.get("password"),
        }),
        signal: AbortSignal.timeout(10000),
      });
      setSession(session);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось войти.");
    } finally {
      setLoading(false);
    }
  }

  const [health, setHealth] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );

  async function checkConnection() {
    setHealth("loading");
    try {
      await fetchApi("/api/health", { signal: AbortSignal.timeout(5000) });
      setHealth("ok");
    } catch {
      setHealth("error");
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-content">
          <span className="brand">Истинный интеллект</span>
          {session && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setSession(null)}
            >
              Выйти
            </button>
          )}
        </div>
      </header>

      {session ? (
        <Dashboard session={session} />
      ) : (
        <main className="login-layout">
          <section className="surface login-panel">
            <h1>Вход в кабинет</h1>
            <form onSubmit={login}>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  maxLength={254}
                />
              </label>
              <label>
                Пароль
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="button button-primary"
                disabled={loading}
              >
                {loading ? "Входим…" : "Войти"}
              </button>
            </form>
            <div className="connection-check">
              <button
                type="button"
                className="button button-secondary"
                disabled={health === "loading"}
                onClick={checkConnection}
              >
                Проверить подключение
              </button>
              <p role="status">
                {health === "loading" && "Проверяем подключение…"}
                {health === "ok" && "PostgreSQL доступен."}
                {health === "error" &&
                  "Не удалось подтвердить подключение к PostgreSQL."}
              </p>
            </div>
          </section>
        </main>
      )}
    </>
  );
}
