"use client";

import { useState } from "react";
import { type Branch, type Company, type Session } from "../analytics-api";
import { useSession } from "../cabinet";
import { useData } from "../use-data";

const statuses = {
  pending: "Ожидает обработки",
  processed: "Обработан",
} as const;

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeZone: "UTC",
});

type ReviewPage = {
  items: {
    id: number;
    branchId: number;
    publishedAt: string;
    rating: number;
    body: string;
    status: keyof typeof statuses;
  }[];
  nextBeforeId: number | null;
};

export default function Reviews() {
  const session = useSession();
  return session && <ReviewsList session={session} />;
}

function ReviewsList({ session: { accessToken, user } }: { session: Session }) {
  const [selectedCompany, setCompany] = useState("");
  const [branch, setBranch] = useState("");
  const [rating, setRating] = useState("");
  const [status, setStatus] = useState("");
  const [cursors, setCursors] = useState<number[]>([]);
  const companies = useData<Company[]>("/api/companies", accessToken);
  const company =
    user.companyId?.toString() ||
    selectedCompany ||
    companies.data?.[0]?.id.toString() ||
    "";
  const branches = useData<Branch[]>(
    company ? `/api/companies/${company}/branches` : null,
    accessToken,
  );

  const filters = new URLSearchParams();
  if (rating) filters.set("rating", rating);
  if (status) filters.set("status", status);
  const cursor = cursors.at(-1);
  if (cursor !== undefined) filters.set("beforeId", String(cursor));

  const scope = branch
    ? `/api/branches/${branch}`
    : `/api/companies/${company}`;
  const reviews = useData<ReviewPage>(
    company ? `${scope}/reviews?${filters}` : null,
    accessToken,
  );
  const error = companies.error ?? branches.error ?? reviews.error;
  const nextCursor = reviews.data?.nextBeforeId;

  return (
    <main className="shell dashboard">
      <div className="dashboard-heading">
        <h1>Отзывы</h1>
      </div>
      <section className="surface filters" aria-label="Фильтры отзывов">
        <label>
          Компания
          <select
            value={company}
            disabled={
              companies.loading || !!companies.error || user.role === "client"
            }
            onChange={(event) => {
              setCompany(event.target.value);
              setBranch("");
              setCursors([]);
            }}
          >
            {!companies.data?.length && (
              <option value={company}>Нет доступных компаний</option>
            )}
            {companies.data?.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Филиал
          <select
            value={branch}
            disabled={!company || branches.loading || !!branches.error}
            onChange={(event) => {
              setBranch(event.target.value);
              setCursors([]);
            }}
          >
            <option value="">Все филиалы</option>
            {branches.data?.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Рейтинг
          <select
            value={rating}
            onChange={(event) => {
              setRating(event.target.value);
              setCursors([]);
            }}
          >
            <option value="">Любая оценка</option>
            {[5, 4, 3, 2, 1].map((score) => (
              <option key={score} value={score}>
                {score}
              </option>
            ))}
          </select>
        </label>
        <label>
          Статус
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setCursors([]);
            }}
          >
            <option value="">Все статусы</option>
            {Object.entries(statuses).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {(companies.loading || reviews.loading) && (
        <p className="status" role="status">
          Загружаем отзывы…
        </p>
      )}
      {reviews.data?.items.length === 0 && (
        <p className="status">Отзывы не найдены.</p>
      )}
      {!!reviews.data?.items.length && (
        <ul className="reviews-list" aria-label="Список отзывов">
          {reviews.data.items.map((review) => (
            <li className="surface review-card" key={review.id}>
              <div className="review-meta">
                <strong>Оценка {review.rating} из 5</strong>
                <span>{statuses[review.status]}</span>
                <time dateTime={review.publishedAt}>
                  {dateFormat.format(new Date(review.publishedAt))}
                </time>
                {branches.data?.find(({ id }) => id === review.branchId)?.name}
              </div>
              {review.body && <p>{review.body}</p>}
            </li>
          ))}
        </ul>
      )}
      {(cursors.length > 0 || nextCursor != null) && (
        <nav className="topbar-actions" aria-label="Страницы отзывов">
          {cursors.length > 0 && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setCursors(cursors.slice(0, -1))}
            >
              Предыдущая
            </button>
          )}
          {nextCursor != null && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setCursors([...cursors, nextCursor])}
            >
              Следующая
            </button>
          )}
        </nav>
      )}
    </main>
  );
}
