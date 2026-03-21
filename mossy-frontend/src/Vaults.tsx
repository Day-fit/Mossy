import {useEffect} from "react";
import {useAuth} from "./auth/context/AuthContext.tsx";
import {useNavigate} from "react-router-dom";
import VaultHero from "./ui/vaults/VaultHero.tsx";

export default function Vaults() {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated === false) {
            navigate("/login");
        }
    }, [isAuthenticated, navigate]);

    if (isAuthenticated !== true) {
        return null;
    }

    return <VaultHero/>;
}
