import {PiSealWarningFill} from "react-icons/pi";
import {AiFillInfoCircle} from "react-icons/ai";
import {MdDelete} from "react-icons/md";
import type {Dispatch, SetStateAction} from "react";
import {motion, type Variants} from "framer-motion";

interface ResponseToastProps {
    message: string,
    isError?: boolean
    className?: string
    setResponseState: Dispatch<SetStateAction<{ message: string, isError?: boolean }>>
}

export default function ResponseToast({message, isError, className, setResponseState}: ResponseToastProps) {
    const ErrorIcon = motion.create(PiSealWarningFill)
    const InfoIcon = motion.create(AiFillInfoCircle)
    const DeleteIcon = motion.create(MdDelete)

    const variants: Variants = {
        hidden: {
            opacity: 0,
            scaleX: 0.05,
        },
        visible: {
            opacity: 1,
            scaleX: 1,
            transition: {
                duration: 0.3,
                ease: "easeOut",
            }
        }
    }

    return isError !== undefined && <motion.div
        initial="hidden"
        animate="visible"
        variants={variants}
        className={`${isError ? "bg-red-500 " : "bg-green-500"} flex items-center gap-2 p-2 rounded-md origin-right ${className}`}>
        {!isError && (
            <InfoIcon
                initial={{opacity: 0}}
                animate={{opacity: 1, transition: {delay: 0.3, duration: 0.3}}}
                className="text-white text-3xl"/>
        )}

        {isError && (
            <ErrorIcon initial={{opacity: 0}}
                       animate={{opacity: 1, transition: {delay: 0.3, duration: 0.3}}} className="text-white text-3xl"/>
        )}
        <motion.p
            initial={{opacity: 0}}
            animate={{opacity: 1, transition: {delay: 0.3, duration: 0.3}}}
            className="text-white text-lg">{message}</motion.p>

        <DeleteIcon initial={{opacity: 0}}
                    animate={{opacity: 1, transition: {delay: 0.3, duration: 0.3}}}
                    className="text-white text-3xl cursor-pointer"
                    onClick={() => {
                        setResponseState({message: "", isError: undefined})
                    }}
        />
    </motion.div>
}