"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type FormEvent,
  createContext,
  type ReactNode,
  useContext,
  useState,
} from "react";
import { checkHealth, login, type LoginResponse } from "./api-client";
import { apiErrorMessage } from "./api-config";

const SessionContext = createContext<LoginResponse | null>(null);

export function useSession() {
  return useContext(SessionContext);
}

export function Cabinet({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const onReviewsPage = pathname === "/reviews";
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const fields = new FormData(event.currentTarget);
    setLoading(true);
    setError("");
    try {
      const { data } = await login({
        body: {
          email: String(fields.get("email") ?? ""),
          password: String(fields.get("password") ?? ""),
        },
        signal: AbortSignal.timeout(10000),
        throwOnError: true,
      });
      setSession(data);
    } catch (error) {
      setError(apiErrorMessage(error));
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
      await checkHealth({
        signal: AbortSignal.timeout(5000),
        throwOnError: true,
      });
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
            <nav className="topbar-actions" aria-label="Навигация по кабинету">
              <Link
                className="button button-secondary"
                href={onReviewsPage ? "/" : "/reviews"}
              >
                {onReviewsPage ? "На главную" : "Отзывы"}
              </Link>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setSession(null);
                  if (onReviewsPage) router.replace("/");
                }}
              >
                Выйти
              </button>
            </nav>
          )}
        </div>
      </header>

      <SessionContext.Provider value={session}>
        {children}
      </SessionContext.Provider>
      {!session && (
        <main className="login-layout">
          <section className="surface login-panel">
            <h1>Вход в кабинет</h1>
            <form onSubmit={signIn}>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="admin@example.test или client@example.test"
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
                  placeholder="как логин до @"
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
