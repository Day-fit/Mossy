import { createContext, useEffect, useState } from "react";
import * as React from "react";

type User = {
    id: string;
    email: string;
};

type AuthContextType = {
    user: User | null;
    loggedIn: boolean;
    login: (u: User) => void;
    logout: () => void;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);

    const login = (u: User) => {
        setUser(u);
        localStorage.setItem("user", JSON.stringify(u));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem("user");
    };

    useEffect(() => {
        const stored = localStorage.getItem("user");
        if (stored) setUser(JSON.parse(stored));
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                loggedIn: !!user,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}