import { NavLink } from "react-router-dom";
import {motion} from "framer-motion";
import {useAuth} from "../../auth/context/AuthContext.tsx";

interface NavTabProps {
    name: string
    url: string
    requiresAuthentication: boolean
}

function NavTab({name, url, requiresAuthentication}: NavTabProps) {
    const { isAuthenticated } = useAuth()
    const MotionNavLink = motion.create(NavLink);

    return (isAuthenticated == true || !requiresAuthentication) &&
        <section className={"relative flex flex-col justify-center items-center h-full"}>
            <MotionNavLink
                to={url}
                className={({isActive}) => (isActive ? "font-bold" : "font-normal")
                    + " text-justify text-l relative z-10 flex items-center justify-center h-full px-5"}
            >
                {({isActive}) => (
                    <>
                        {isActive && <motion.div
                            className="absolute bottom-5 left-2 right-2 border-b-2 border-emerald-500"
                            initial={{scaleX: 0}}
                            animate={{scaleX: 1}}
                            transition={{duration: 0.2, ease: "easeOut"}}
                            style={{transformOrigin: "right"}}
                        />
                        }
                        <span>
                            {name}
                        </span>
                    </>
                )}
            </MotionNavLink>
        </section>
}

export default NavTab