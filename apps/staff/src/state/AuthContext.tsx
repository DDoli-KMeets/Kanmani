import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { clearTokens, getAccessToken, setTokens } from "../api/client";
import { getMe } from "../api/endpoints";
import type { StaffProfile } from "../api/types";

const STAFF_ROLES = new Set(["VENUE_STAFF", "TRUST_AND_SAFETY", "SUPER_ADMIN"]);

interface AuthContextValue {
  profile: StaffProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAuthorizedStaff: boolean;
  signIn: (accessToken: string, refreshToken: string) => Promise<StaffProfile | null>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (): Promise<StaffProfile | null> => {
    if (!getAccessToken()) {
      setProfile(null);
      return null;
    }
    try {
      const me = await getMe();
      setProfile(me);
      return me;
    } catch {
      clearTokens();
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    loadProfile().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(
    async (accessToken: string, refreshToken: string) => {
      setTokens(accessToken, refreshToken);
      const me = await loadProfile();
      // The consumer app is for members; this dashboard is for staff/admin
      // only — a member who somehow signs in here is signed straight back
      // out rather than being shown an empty, permission-denied dashboard.
      if (me && !STAFF_ROLES.has(me.role)) {
        clearTokens();
        setProfile(null);
        return null;
      }
      return me;
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
      isAuthorizedStaff: Boolean(profile && STAFF_ROLES.has(profile.role)),
      signIn,
      signOut,
    }),
    [profile, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
