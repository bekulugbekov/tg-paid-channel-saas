// All paths are relative — Vite proxies /api → Express in dev

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const get  = <T>(path: string)                  => req<T>("GET",    path);
const post = <T>(path: string, body?: unknown)   => req<T>("POST",   path, body);
const patch= <T>(path: string, body?: unknown)   => req<T>("PATCH",  path, body);
const put  = <T>(path: string, body?: unknown)   => req<T>("PUT",    path, body);
const del  = <T>(path: string)                   => req<T>("DELETE", path);

// ── Types ────────────────────────────────────────────────────────────────────

export interface Creator {
  id: string;
  telegramId: string;
  firstName?: string;
  username?: string;
  saasPlan: string;
  saasExpiresAt?: string | null;
  hasPayme: boolean;
  hasClick: boolean;
  isAdmin?: boolean;
  paymeMerchantId?: string;
  clickServiceId?: string;
  clickMerchantId?: string;
  clickUserId?: string;
}

export interface AdminCreator {
  id: string;
  telegramId: string;
  firstName?: string;
  username?: string;
  saasPlan: "FREE" | "PRO" | "BUSINESS";
  saasExpiresAt: string | null;
  createdAt: string;
  channelCount: number;
  planCount: number;
  activeSubs: number;
  totalRevenue: number;
  hasPayme: boolean;
  hasClick: boolean;
}

export interface AdminStats {
  totalCreators: number;
  totalChannels: number;
  totalActiveSubs: number;
  totalRevenue: number;
}

export interface AdminCreatorsPage {
  creators: AdminCreator[];
  total: number;
  page: number;
  limit: number;
}

export interface Channel {
  id: string;
  telegramChannelId: string;
  title: string;
  description?: string;
  isActive: boolean;
  activeSubscribers: number;
  deepLink: string;
  plans: Plan[];
}

export interface Plan {
  id: string;
  channelId: string;
  name: string;
  priceUzs: number;
  durationDays: number;
  description?: string;
  isActive: boolean;
  channel?: { id: string; title: string };
  activeSubscribers?: number;
}

export interface Subscription {
  id: string;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  startedAt?: string;
  expiresAt?: string;
  createdAt: string;
  subscriber: { id: string; telegramId: string; username?: string; firstName?: string };
  plan: { id: string; name: string; priceUzs: number };
  channel: { id: string; title: string };
}

export interface Stats {
  totalRevenue: number;
  monthlyRevenue: number;
  activeSubscribersCount: number;
  totalSubscribersCount: number;
  planBreakdown: Array<{ planId: string; planName: string; count: number; revenue: number }>;
}

// ── API calls ────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    login:  (user: Record<string, unknown>) => post<{ ok: boolean }>("/api/auth/telegram", user),
    logout: ()                               => post<{ ok: boolean }>("/api/auth/logout"),
  },
  me: {
    get: () => get<Creator>("/api/me"),
  },
  channels: {
    list: () => get<Channel[]>("/api/channels"),
  },
  plans: {
    list:   (channelId?: string) => get<Plan[]>(`/api/plans${channelId ? `?channelId=${channelId}` : ""}`),
    create: (data: Partial<Plan>) => post<Plan>("/api/plans", data),
    update: (id: string, data: Partial<Plan>) => patch<Plan>(`/api/plans/${id}`, data),
    delete: (id: string)                      => del<{ ok: boolean }>(`/api/plans/${id}`),
  },
  subscribers: {
    list:   (params?: { status?: string; channelId?: string }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return get<Subscription[]>(`/api/subscribers${qs ? `?${qs}` : ""}`);
    },
    extend: (id: string, days: number) => post<Subscription>(`/api/subscribers/${id}/extend`, { days }),
    revoke: (id: string)               => post<Subscription>(`/api/subscribers/${id}/revoke`),
  },
  settings: {
    saveMerchant: (data: Record<string, string>) => put<{ ok: boolean }>("/api/settings/merchant", data),
  },
  stats: {
    get: () => get<Stats>("/api/stats"),
  },
  admin: {
    stats:    ()                                          => get<AdminStats>("/api/admin/stats"),
    creators: (page = 1, limit = 20)                     => get<AdminCreatorsPage>(`/api/admin/creators?page=${page}&limit=${limit}`),
    setPlan:  (id: string, saasPlan: string, saasExpiresAt?: string | null) =>
      req<AdminCreator>("PATCH", `/api/admin/creators/${id}/plan`, { saasPlan, saasExpiresAt }),
  },
};
