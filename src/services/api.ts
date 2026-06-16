// src/lib/api.ts

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const apiFetch = async (
  path: string,
  options: RequestInit = {}
) => {
  const token = getToken(); // reuse your existing function

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "API request failed");
  }

  return res;
};

export const apiClient = {
  post: async (path: string, data: any) => {
    try {
      const res = await apiFetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      return await res.json().catch(() => ({}));
    } catch (e: any) {
      const error: any = new Error(e.message || "API request failed");
      error.response = {
        data: {
          error: e.message || "API request failed",
        },
      };
      throw error;
    }
  },
  get: async (path: string) => {
    try {
      const res = await apiFetch(path, {
        method: "GET",
      });
      return await res.json().catch(() => ({}));
    } catch (e: any) {
      const error: any = new Error(e.message || "API request failed");
      error.response = {
        data: {
          error: e.message || "API request failed",
        },
      };
      throw error;
    }
  },
  put: async (path: string, data: any) => {
    try {
      const res = await apiFetch(path, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      return await res.json().catch(() => ({}));
    } catch (e: any) {
      const error: any = new Error(e.message || "API request failed");
      error.response = {
        data: {
          error: e.message || "API request failed",
        },
      };
      throw error;
    }
  },
  delete: async (path: string) => {
    try {
      const res = await apiFetch(path, {
        method: "DELETE",
      });
      return await res.json().catch(() => ({}));
    } catch (e: any) {
      const error: any = new Error(e.message || "API request failed");
      error.response = {
        data: {
          error: e.message || "API request failed",
        },
      };
      throw error;
    }
  },
};

const getToken = () => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const storageKey = `sb-${projectId}-auth-token`;

  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw)?.access_token;
  } catch {
    return null;
  }
};