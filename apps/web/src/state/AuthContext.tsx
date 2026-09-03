import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { clearTokens, getAccessToken, setTokens } from "../api/client";
import { getMe } from "../api/endpoints";
import type { UserProfile } from "../api/types";

interface AuthContextValue {
  profile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (accessToken: string, refreshToken: string) => Promise<void>;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!getAccessToken()) {
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      const me = await getMe();
      setProfile(me);
    } catch {
      clearTokens();
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(
    async (accessToken: string, refreshToken: string) => {
      setTokens(accessToken, refreshToken);
      setLoading(true);
      await loadProfile();
    },
    [loadProfile],
  );

  const signOut = useCallback(() => {
    clearTokens();
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      profile,
      loading,
      isAuthenticated: Boolean(profile),
      signIn,
      signOut,
      refreshProfile: loadProfile,
    }),
    [profile, loading, signIn, signOut, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
