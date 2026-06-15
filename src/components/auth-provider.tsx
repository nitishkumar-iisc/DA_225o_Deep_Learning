"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User as FirebaseUser, onIdTokenChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { UserRole } from "@/types";

interface AuthState {
  user: FirebaseUser | null;
  role: UserRole | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  role: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    return onIdTokenChanged(auth, async (user) => {
      if (!user) {
        // Clear cookie on sign-out
        document.cookie = "token=; Max-Age=0; path=/";
        setState({ user: null, role: null, loading: false });
        return;
      }

      const idTokenResult = await user.getIdTokenResult();
      const token = idTokenResult.token;
      const role = (idTokenResult.claims.role as UserRole) ?? null;

      // Write token cookie so middleware can read it (HttpOnly not possible from
      // client, but middleware only needs to detect presence; the API routes
      // verify via Admin SDK)
      document.cookie = `token=${token}; path=/; SameSite=Strict`;

      setState({ user, role, loading: false });
    });
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
