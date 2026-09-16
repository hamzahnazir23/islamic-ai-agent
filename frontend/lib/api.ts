// All requests carry the session cookie. The API lives on another port,
// so `credentials: "include"` is mandatory — without it the browser sends
// no cookie and every authenticated call fails as 401.
//
// Use http://localhost:8000 rather than 127.0.0.1: the cookie is issued
// for the API's host, and localhost:3000 -> localhost:8000 counts as
// same-site (ports are not part of the site), so a SameSite=Lax cookie is
// sent. Mixing the two hostnames silently breaks the session.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "Could not reach the Aalim server. Is it running?");
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(res.status, body));
  }
  return body as T;
}

function errorMessage(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;

  // FastAPI validation errors arrive as a list of field errors.
  if (Array.isArray(detail)) {
    const first = detail[0] as { loc?: string[]; msg?: string } | undefined;
    const field = first?.loc?.[first.loc.length - 1];
    if (field === "email") return "Please enter a valid email address.";
    if (field === "password") return "Password must be at least 8 characters.";
    return first?.msg ?? "Please check the details you entered.";
  }
  if (typeof detail === "string") return detail;

  if (status === 401) return "Your session has expired. Please log in again.";
  if (status === 429) return "Too many attempts. Please wait and try again.";
  return "Something went wrong. Please try again.";
}

// ---- types ----

export type User = { id: number; email: string };

export type Source = {
  source_type: string;
  reference: string;
  text: string;
  similarity: number;
};

export type StoredMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  status?: "ok" | "general" | "refusal" | null;
  sources: Source[];
  created_at: string;
};

export type ConversationSummary = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ConversationDetail = ConversationSummary & {
  messages: StoredMessage[];
};

export type AskResponse = {
  status: "ok" | "general" | "refusal";
  answer: string | null;
  sources: Source[];
  message: string | null;
  conversation_id: number | null;
};

// ---- calls ----

export const api = {
  register: (email: string, password: string) =>
    request<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<User>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<void>("/auth/logout", { method: "POST" }),

  me: () => request<User>("/auth/me"),

  listConversations: () =>
    request<ConversationSummary[]>("/conversations"),

  getConversation: (id: number) =>
    request<ConversationDetail>(`/conversations/${id}`),

  newConversation: () =>
    request<ConversationDetail>("/conversations", { method: "POST" }),

  deleteConversation: (id: number) =>
    request<void>(`/conversations/${id}`, { method: "DELETE" }),

  ask: (body: {
    question: string;
    history: { role: string; content: string }[];
    language: string;
    conversation_id?: number | null;
  }) =>
    request<AskResponse>("/ask", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
