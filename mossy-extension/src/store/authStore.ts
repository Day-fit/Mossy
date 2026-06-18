import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import type { UserDetailsResponse } from "../types";

type AuthStoreState = {
  isAuthenticated: boolean | null;
  userDetails: UserDetailsResponse | null;
  setIsAuthenticated: (value: boolean | null) => void;
  setUserDetails: (value: UserDetailsResponse | null) => void;
};

const AuthStoreContext = createContext<AuthStoreState | null>(null);

export function AuthStoreProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetailsResponse | null>(
    null,
  );

  const value = useMemo<AuthStoreState>(
    () => ({
      isAuthenticated,
      userDetails,
      setIsAuthenticated,
      setUserDetails,
    }),
    [isAuthenticated, userDetails],
  );

  return createElement(AuthStoreContext.Provider, { value }, children);
}

export function useAuthStore<T = AuthStoreState>(
  selector?: (state: AuthStoreState) => T,
): T {
  const state = useContext(AuthStoreContext);
  if (!state) throw new Error("useAuthStore must be used within AuthStoreProvider");
  return selector ? selector(state) : (state as T);
}
