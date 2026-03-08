import {createContext, type ReactNode, useContext, useEffect, useState} from "react";
import {tokenStorage} from "../tokenStorage.ts";
import {executeCheckAuthState, executeRefreshRequest} from "../../api/auth.api.ts";

type AuthState = {
    isAuthenticated: boolean | null;
    login: (token: string) => void;
    logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({children}: { children: ReactNode }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const token = tokenStorage.get();
        const refreshToken = () => {
            executeRefreshRequest()
                .then(res => res.json())
                .then(data => {
                    if (data.accessToken) {
                        tokenStorage.set(data.accessToken);
                        setIsAuthenticated(true);
                    }
                })
                .catch(() => {
                    setIsAuthenticated(false);
                });
        }

        if (token == null) {
            refreshToken();
            return;
        }

        executeCheckAuthState({ token })
            .then(res => res.json())
            .then(data => {
                setIsAuthenticated(data.isAuthenticated);
            })
            .catch(() => {
                refreshToken();
            });
    }, []);

    const login = (token: string) => {
        tokenStorage.set(token);
        setIsAuthenticated(true);
    };

    const logout = () => {
        tokenStorage.set(null);
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext)!;