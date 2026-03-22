import NavTab from './NavTab.tsx'
import RippleButton from "./RippleButton.tsx";
import {useNavigate} from "react-router-dom";
import {useState} from "react";
import {AnimatePresence, motion, type Variants} from "framer-motion";

const menuVariants: Variants = {
    hidden: {opacity: 0, height: 0},
    visible: {
        opacity: 1,
        height: "auto",
        transition: {
            duration: 0.3,
            ease: "easeOut" as const,
            when: "beforeChildren",
            staggerChildren: 0.08,
        },
    },
    exit: {
        opacity: 0,
        height: 0,
        transition: {duration: 0.2, ease: "easeIn" as const},
    },
};

const itemVariants = {
    hidden: {opacity: 0, y: -10},
    visible: {opacity: 1, y: 0, transition: {duration: 0.2}},
    exit: {opacity: 0, y: -10, transition: {duration: 0.15}},
};

const navItems = [
    {name: "Dashboard", url: "/dashboard", requiresAuthentication: true},
    {name: "Vaults", url: "/vaults", requiresAuthentication: true},
    {name: "Passwords", url: "/passwords", requiresAuthentication: true},
];

function Nav() {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(prev => !prev);
    const closeMenu = () => setIsOpen(false);

    return (
        <>
            <nav
                className="flex justify-between items-center w-full h-20 border-b-gray-200 border-b-2 sticky top-0 bg-white z-50">
                <img className="h-full p-2 cursor-pointer" alt="mossy-logo" src="/mossy_logo.png"
                    onClick={() => { navigate("/"); closeMenu(); }}
                />

                <div className="hidden sm:flex gap-10 items-center h-full">
                    {navItems.map(item => (
                        <NavTab key={item.url} name={item.name} url={item.url} requiresAuthentication={item.requiresAuthentication}/>
                    ))}
                </div>

                <div className="hidden sm:flex mr-2">
                    <RippleButton className="text-white sm:mr-1" onClick={() => navigate("/register")}>Sign
                        Up</RippleButton>
                    <RippleButton className="bg-transparent border-2 border-gray-800" rippleColor="rgb(0, 0, 0, 0.7)"
                                  onClick={() => navigate("/login")}
                    >Sign In</RippleButton>
                </div>

                <button
                    className="sm:hidden mr-4 flex flex-col justify-center items-center w-10 h-10 cursor-pointer"
                    onClick={toggleMenu}
                    aria-label={isOpen ? "Close menu" : "Open menu"}
                >
                    <motion.span
                        animate={isOpen ? {rotate: 45, y: 6} : {rotate: 0, y: 0}}
                        transition={{duration: 0.2}}
                        className="block w-6 h-0.5 bg-gray-800 mb-1.5"
                    />
                    <motion.span
                        animate={isOpen ? {opacity: 0, scaleX: 0} : {opacity: 1, scaleX: 1}}
                        transition={{duration: 0.2}}
                        className="block w-6 h-0.5 bg-gray-800 mb-1.5"
                    />
                    <motion.span
                        animate={isOpen ? {rotate: -45, y: -6} : {rotate: 0, y: 0}}
                        transition={{duration: 0.2}}
                        className="block w-6 h-0.5 bg-gray-800"
                    />
                </button>
            </nav>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="mobile-menu"
                        variants={menuVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="sm:hidden overflow-hidden bg-white border-b-2 border-gray-200 sticky top-20 z-40 w-full"
                    >
                        <div className="flex flex-col items-start px-6 py-4 gap-4">
                            {navItems.map(item => (
                                <motion.div key={item.url} variants={itemVariants} className="w-full">
                                    <NavTab name={item.name} url={item.url} requiresAuthentication={item.requiresAuthentication} onClick={closeMenu}/>
                                </motion.div>
                            ))}
                            <motion.div variants={itemVariants} className="flex flex-col gap-3 w-full pt-2">
                                <RippleButton className="text-white w-full" onClick={() => { navigate("/register"); closeMenu(); }}>Sign Up</RippleButton>
                                <RippleButton className="bg-transparent border-2 border-gray-800 w-full" rippleColor="rgb(0, 0, 0, 0.7)" onClick={() => { navigate("/login"); closeMenu(); }}>Sign In</RippleButton>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

export default Nav
