import NavTab from './NavTab.tsx'
import RippleButton from "./RippleButton.tsx";
import {useNavigate} from "react-router-dom";

function Nav() {
    const navigate = useNavigate();

    return (
        <nav
            className="flex justify-between items-center w-full h-20 border-b-gray-200 border-b-2 sticky top-0 bg-white z-50">
            <img className="h-full p-2 cursor-pointer" alt="mossy-logo" src="/mossy_logo.png"
                onClick={() => navigate("/")}
            />

            <div className="flex gap-10 items-center h-full">
                <NavTab name="Dashboard" url="/dashboard" requiresAuthentication={true}/>
                <NavTab name="Passwords" url="/passwords" requiresAuthentication={true}/>
            </div>

            <div className="mr-2">
                <RippleButton className="text-white sm:mr-1" onClick={() => navigate("/register")}>Sign
                    Up</RippleButton>
                <RippleButton className="bg-transparent border-2 border-gray-800" rippleColor="rgb(0, 0, 0, 0.7)"
                              onClick={() => navigate("/login")}
                >Sign In</RippleButton>
            </div>
        </nav>
    )
}

export default Nav