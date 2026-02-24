import { useContext } from "react";
import { AuthContext } from "./AuthProvider";

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("context not found");
    }
    return ctx;
}