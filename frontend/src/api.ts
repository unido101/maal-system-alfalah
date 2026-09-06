import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export const TOKEN_KEY = "bmaf_session_token";

let inMemoryToken: string | null = null;

export function setToken(token: string | null) {
  inMemoryToken = token;
}

export function getToken(): string | null {
  return inMemoryToken;
}

export async function loadToken(): Promise<string | null> {
  const t = await storage.secureGet<string>(TOKEN_KEY, "");
  inMemoryToken = t || null;
  return inMemoryToken;
}

export async function persistToken(token: string) {
  inMemoryToken = token;
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken() {
  inMemoryToken = null;
  await storage.secureRemove(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: any
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (inMemoryToken) {
    headers["Authorization"] = `Bearer ${inMemoryToken}`;
  }

  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && (data.detail || data.message)) ||
      `Terjadi kesalahan (${res.status})`;

    throw new ApiError(
      res.status,
      typeof msg === "string"
        ? msg
        : "Terjadi kesalahan"
    );
  }

  return data as T;
}

/**
 * Request untuk mengambil file binary
 * seperti Excel, CSV, dan PDF.
 *
 * Hasil akhirnya dikembalikan sebagai Base64
 * agar bisa disimpan oleh Expo FileSystem.
 */
async function getBinary(path: string): Promise<string> {
  const headers: Record<string, string> = {};

  if (inMemoryToken) {
    headers["Authorization"] = `Bearer ${inMemoryToken}`;
  }

  const res = await fetch(`${BASE}/api${path}`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    const text = await res.text();

    let data: any = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    const msg =
      (data && (data.detail || data.message)) ||
      `Terjadi kesalahan (${res.status})`;

    throw new ApiError(
      res.status,
      typeof msg === "string"
        ? msg
        : "Gagal mengambil file"
    );
  }

  const arrayBuffer = await res.arrayBuffer();

  const bytes = new Uint8Array(arrayBuffer);

  let binary = "";

  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(
      i,
      Math.min(i + chunkSize, bytes.length)
    );

    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function qs(params?: Record<string, any>): string {
  if (!params) return "";

  const parts = Object.entries(params)
    .filter(
      ([, v]) =>
        v !== undefined &&
        v !== null &&
        v !== ""
    )
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(
          String(v)
        )}`
    );

  return parts.length
    ? `?${parts.join("&")}`
    : "";
}

export const api = {
  get: <T = any>(
    path: string,
    params?: Record<string, any>
  ) =>
    request<T>(
      "GET",
      path + qs(params)
    ),

  post: <T = any>(
    path: string,
    body?: any
  ) =>
    request<T>(
      "POST",
      path,
      body
    ),

  put: <T = any>(
    path: string,
    body?: any
  ) =>
    request<T>(
      "PUT",
      path,
      body
    ),

  patch: <T = any>(
    path: string,
    body?: any
  ) =>
    request<T>(
      "PATCH",
      path,
      body
    ),

  del: <T = any>(
    path: string
  ) =>
    request<T>(
      "DELETE",
      path
    ),

  getBinary,
};
