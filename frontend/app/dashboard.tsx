"use client";

import { useEffect, useState } from "react";
import {
  type Branch,
  type Company,
  fetchApi,
  type Report,
  type Session,
} from "./analytics-api";

const numberFormat = new Intl.NumberFormat("ru-RU");
const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function displayDate(date: string) {
  return dateFormat.format(new Date(date + "T00:00:00Z"));
}

function initialPeriod() {
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 29);
  return {
    from: start.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

function useData<T>(path: string | null, token: string) {
  const [result, setResult] = useState<{
    path: string;
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
        if (!controller.signal.aborted) setResult({ path, data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setResult({
            path,
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

  return {
    data: result?.path === path ? result.data : undefined,
    error: result?.path === path ? result.error : undefined,
    loading: path !== null && path !== result?.path,
  };
}

const measures = [
  ["cardViews", "Просмотры карточек"],
  ["websiteClicks", "Переходы на сайт"],
  ["calls", "Звонки"],
  ["routeRequests", "Построенные маршруты"],
  ["averageRating", "Средняя оценка"],
  ["reviewCount", "Количество отзывов"],
] as const;

export function Dashboard({ session }: { session: Session }) {
  const [company, setCompany] = useState(
    session.user.companyId?.toString() ?? "",
  );
  const [branch, setBranch] = useState("");
  const [period, setPeriod] = useState(initialPeriod);
  const { accessToken } = session;

  const companies = useData<Company[]>("/api/companies", accessToken);
  const branches = useData<Branch[]>(
    company ? `/api/companies/${company}/branches` : null,
    accessToken,
  );
  const validPeriod = Boolean(
    period.from && period.to && period.from <= period.to,
  );
  const query = new URLSearchParams(period);
  if (company) query.set("companyId", company);
  if (branch) query.set("branchId", branch);
  const report = useData<Report>(
    validPeriod ? `/api/analytics?${query}` : null,
    accessToken,
  );

  return (
    <main className="shell dashboard">
      <div className="dashboard-heading">
        <h1>Аналитика филиалов</h1>
        <p>{session.user.email}</p>
      </div>

      <section className="surface filters" aria-label="Фильтры отчёта">
        <label className="filter-select">
          <span id="company-label">Компания</span>
          <select
            aria-labelledby="company-label"
            value={company}
            disabled={companies.loading || Boolean(companies.error)}
            onChange={(event) => {
              setCompany(event.target.value);
              setBranch("");
            }}
          >
            {session.user.role === "admin" && (
              <option value="">Все компании</option>
            )}
            {session.user.role === "client" && !companies.data && (
              <option value={company}>
                {companies.loading ? "Загрузка…" : "Недоступно"}
              </option>
            )}
            {companies.data?.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-select">
          <span id="branch-label">Филиал</span>
          <select
            aria-labelledby="branch-label"
            value={branch}
            disabled={!company || branches.loading || Boolean(branches.error)}
            onChange={(event) => setBranch(event.target.value)}
          >
            <option value="">
              {branches.loading ? "Загрузка…" : "Все филиалы"}
            </option>
            {branches.data?.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Начало периода
          <input
            type="date"
            value={period.from}
            onChange={(event) =>
              setPeriod((current) => ({ ...current, from: event.target.value }))
            }
          />
        </label>
        <label>
          Конец периода
          <input
            type="date"
            value={period.to}
            onChange={(event) =>
              setPeriod((current) => ({ ...current, to: event.target.value }))
            }
          />
        </label>
      </section>

      {(companies.error || branches.error) && (
        <p className="error" role="alert">
          {companies.error ?? branches.error}
        </p>
      )}
      {!validPeriod && (
        <p className="error" role="alert">
          Укажите начало и конец периода в порядке дат.
        </p>
      )}
      {report.loading && (
        <p className="status" role="status">
          Загружаем отчёт…
        </p>
      )}
      {report.error && (
        <p className="error" role="alert">
          {report.error}
        </p>
      )}
      {report.data && <ReportView report={report.data} />}
    </main>
  );
}

function ReportView({ report }: { report: Report }) {
  const days = report.dailyCardViews;
  const max = days.reduce(
    (highest, day) => Math.max(highest, day.cardViews),
    0,
  );

  return (
    <>
      <dl className="metric-grid" aria-label="Итоговые показатели">
        {measures.map(([key, label]) => {
          const value = report.totals[key];
          return (
            <div className="surface metric" key={key}>
              <dt>{label}</dt>
              <dd>
                {value === null ? "Нет оценок" : numberFormat.format(value)}
              </dd>
            </div>
          );
        })}
      </dl>
      <section className="surface chart" aria-labelledby="chart-title">
        <header className="chart-heading">
          <h2 id="chart-title">Просмотры по дням</h2>
          <p>
            {displayDate(days[0].date)} —{" "}
            {displayDate(days[days.length - 1].date)}
          </p>
        </header>
        <div className="chart-plot">
          <div className="chart-scale" aria-hidden="true">
            <span>{numberFormat.format(max)}</span>
            <span>0</span>
          </div>
          <div className="chart-bars" aria-hidden="true">
            {days.map(({ date, cardViews }) => (
              <div
                className="chart-column"
                key={date}
                title={`${displayDate(date)} · ${numberFormat.format(cardViews)}`}
              >
                <div
                  className="chart-bar"
                  style={{ height: max ? `${(100 * cardViews) / max}%` : "0%" }}
                />
              </div>
            ))}
          </div>
        </div>
        <details className="chart-table">
          <summary>Значения по дням</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">Дата</th>
                <th scope="col">Просмотры</th>
              </tr>
            </thead>
            <tbody>
              {days.map(({ date, cardViews }) => (
                <tr key={date}>
                  <td>{displayDate(date)}</td>
                  <td>{numberFormat.format(cardViews)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
    </>
  );
}
