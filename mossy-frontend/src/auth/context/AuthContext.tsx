import {createContext, type ReactNode, useContext, useEffect, useState} from "react";
import {tokenStorage} from "../tokenStorage.ts";
import {executeCheckAuthState} from "../../api/auth.api.ts";

type AuthState = {
    isAuthenticated: boolean;
    login: (token: string) => void;
    logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({children}: { children: ReactNode }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!tokenStorage.get());

    useEffect(() => {
        const token = tokenStorage.get();
        if (!token) return;

        executeCheckAuthState({ token })
            .then(res => res.json())
            .then(data => {
                setIsAuthenticated(data.isAuthenticated);
            })
            .catch(() => {
                setIsAuthenticated(false);
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