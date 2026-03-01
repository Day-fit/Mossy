import DashboardHero from "./ui/dashboard/DashboardHero.tsx";
import {useAuth} from "./auth/context/AuthContext.tsx";
import {useNavigate} from "react-router-dom";
import {useEffect} from "react";

export default function Dashboard() {
    const { isAuthenticated } = useAuth()
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated == false) {
            navigate("/login");
        }
    }, [isAuthenticated, navigate]);

    return <>
        <DashboardHero/>
    </>
}