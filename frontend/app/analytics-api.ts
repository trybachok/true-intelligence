export type Session = {
  accessToken: string;
  user: {
    id: number;
    email: string;
    role: "admin" | "client";
    companyId: number | null;
  };
};

export type Company = { id: number; name: string };
export type Branch = Company & { companyId: number };

export type Report = {
  totals: {
    cardViews: number;
    websiteClicks: number;
    calls: number;
    routeRequests: number;
    averageRating: number | null;
    reviewCount: number;
  };
  dailyCardViews: { date: string; cardViews: number }[];
};

export async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, { ...options, cache: "no-store" }).catch(
    () => {
      throw new Error("Не удалось связаться с сервером.");
    },
  );
  if (response.ok) return response.json();

  const error = await response.json().catch(() => null);
  const message =
    error?.code === "UNAUTHENTICATED"
      ? "Срок входа истёк. Войдите снова."
      : error?.message;

  throw new Error(
    typeof message === "string"
      ? message
      : "Не удалось получить ответ сервера.",
  );
}
