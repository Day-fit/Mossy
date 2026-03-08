import PasswordHero from "./ui/passwords/PasswordHero.tsx";
import {useEffect} from "react";
import {useAuth} from "./auth/context/AuthContext.tsx";
import {useNavigate} from "react-router-dom";

export default function Passwords() {
    const { isAuthenticated } = useAuth()
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated == false) {
            navigate("/login");
        }
    }, [isAuthenticated, navigate]);

    return <>
        <PasswordHero></PasswordHero>
    </>
}