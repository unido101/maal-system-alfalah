import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { api, persistToken, clearToken, loadToken, setToken } from "@/src/api";

WebBrowser.maybeCompleteAuthSession();

export type User = {
  id: string;
  name: string;
  email: string;
  role: "manager" | "content" | "fundraising";
  avatar?: string | null;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  loginEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (name: string, email: string, password: string, role: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const processedSessions = useRef<Set<string>>(new Set());

  const fetchMe = useCallback(async () => {
    try {
      const me = await api.get<User>("/auth/me");
      setUser(me);
    } catch {
      await clearToken();
      setToken(null);
      setUser(null);
    }
  }, []);

  const exchangeSessionId = useCallback(async (sessionId: string) => {
    if (processedSessions.current.has(sessionId)) return;
    processedSessions.current.add(sessionId);
    try {
      const res = await api.post<{ session_token: string; user: User }>("/auth/session", {
        session_id: sessionId,
      });
      await persistToken(res.session_token);
      setUser(res.user);
    } catch (e) {
      // silent fail -> stays logged out
    }
  }, []);

  // Initial boot: check web url session_id first, then stored token
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "web") {
          const hash = window.location.hash || "";
          const search = window.location.search || "";
          const m = (hash + search).match(/session_id=([^&#]+)/);
          if (m) {
            await exchangeSessionId(decodeURIComponent(m[1]));
            // clean url
            const url = new URL(window.location.href);
            url.hash = "";
            url.searchParams.delete("session_id");
            window.history.replaceState(window.history.state, "", url.toString());
            setLoading(false);
            return;
          }
        } else {
          const initial = await Linking.getInitialURL();
          if (initial) {
            const m = initial.match(/[?#&]session_id=([^&#]+)/);
            if (m) await exchangeSessionId(decodeURIComponent(m[1]));
          }
        }
        const token = await loadToken();
        if (token) await fetchMe();
      } finally {
        setLoading(false);
      }
    })();
  }, [exchangeSessionId, fetchMe]);

  // Hot deep links (native)
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      const m = url.match(/[?#&]session_id=([^&#]+)/);
      if (m) exchangeSessionId(decodeURIComponent(m[1]));
    });
    return () => sub.remove();
  }, [exchangeSessionId]);

  const loginEmail = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ session_token: string; user: User }>("/auth/login", { email, password });
    await persistToken(res.session_token);
    setUser(res.user);
  }, []);

  const registerEmail = useCallback(async (name: string, email: string, password: string, role: string) => {
    const res = await api.post<{ session_token: string; user: User }>("/auth/register", {
      name, email, password, role,
    });
    await persistToken(res.session_token);
    setUser(res.user);
  }, []);

  const loginGoogle = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web" ? window.location.origin + "/" : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type === "success" && result.url) {
      const m = result.url.match(/[?#&]session_id=([^&#]+)/);
      if (m) {
        await exchangeSessionId(decodeURIComponent(m[1]));
        return;
      }
    }
    // Android may return dismiss with no url — check initial url
    const initial = await Linking.getInitialURL();
    if (initial) {
      const m = initial.match(/[?#&]session_id=([^&#]+)/);
      if (m) await exchangeSessionId(decodeURIComponent(m[1]));
    }
  }, [exchangeSessionId]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    await clearToken();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, loginEmail, registerEmail, loginGoogle, logout, refresh: fetchMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}
