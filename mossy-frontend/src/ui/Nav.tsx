import NavTab from './NavTab'
import {useState} from "react";
import RippleButton from "./RippleButton";
import {useNavigate} from "react-router-dom";

function Nav() {
    const [activeTab, setActiveTab] = useState<number>(0)
    const navigate = useNavigate();

    return (
        <nav
            className="flex justify-between items-center w-full h-20 border-b-gray-200 border-b-2 sticky top-0 bg-white z-50">
            <img className="h-full p-2" alt="mossy-logo" src="mossy_logo.png"/>

            <div className="flex gap-10 items-center h-full">
                <NavTab name="Home" url="/" id={0} activeId={activeTab} setActiveTab={setActiveTab}/>
                <NavTab name="Password" url="/passwords" id={1} activeId={activeTab} setActiveTab={setActiveTab}/>
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