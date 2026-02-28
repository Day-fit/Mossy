import {motion, AnimatePresence} from "framer-motion";
import {useState} from "react";
import ResponseToast from "../layout/ResponseToast.tsx";
import SignupForm from "./SignupForm.tsx";
import EmailConfirmation from "./EmailConfirmation.tsx";

export default function SignupHero() {
    const [phase, setPhase] = useState<"register" | "email-verification">("register");
    const [responseState, setResponseState] = useState<{ message: string, isError?: boolean }>({
        message: "",
        isError: undefined
    });

    return <section
        className="relative h-[90vh] w-full perspective-distant overflow-hidden">
        <ResponseToast setResponseState={setResponseState}
                       message={responseState.message} isError={responseState.isError}
                       className="absolute top-10 right-5 max-w-[calc(100vw-2rem)] sm:max-w-md z-10"></ResponseToast>

        <AnimatePresence mode="wait" initial={false}>
            {
                phase == "register" ? (
                    <motion.div
                        key="register"
                        className="absolute inset-0 transform-3d backface-hidden"
                        animate={{rotateY: 0, scale: 1}}
                        initial={{rotateY: -90, scale: 0.95}}
                        exit={{rotateY: 90, scale: 0.95}}
                        transition={{duration: 0.4, ease: "linear"}}
                    >
                        <SignupForm setResponseState={setResponseState}
                                    onSuccess={() => setPhase("email-verification")}/>
                    </motion.div>
                ) : (
                    <motion.div
                        key="email"
                        className="absolute inset-0 transform-3d backface-hidden"
                        animate={{rotateY: 0, scale: 1}}
                        initial={{rotateY: -90, scale: 0.95}}
                        exit={{rotateY: 90, scale: 0.95}}
                        transition={{duration: 0.4, ease: "easeOut"}}
                    >
                        <EmailConfirmation setResponseState={setResponseState}/>
                    </motion.div>
                )
            }
        </AnimatePresence>
    </section>
}