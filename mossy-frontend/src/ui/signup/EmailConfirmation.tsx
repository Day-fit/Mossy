import {AnimatePresence, motion} from "framer-motion";
import RippleButton from "../layout/RippleButton.tsx";
import {useForm} from "react-hook-form";
import {
    emailConfirmationSchema,
    type EmailConfirmationSchema,
} from "../../forms/emailConfirmationSchema.ts";
import {zodResolver} from "@hookform/resolvers/zod";
import {executeConfirmEmailRequest} from "../../api/auth.api.ts";
import  {type Dispatch, type SetStateAction} from "react";
import {useRef, useState} from "react";
import * as React from "react";
import {useNavigate} from "react-router-dom";

interface EmailConfirmationProps {
    setResponseState: Dispatch<
        SetStateAction<{
            message: string;
            isError?: boolean;
        }>
    >;
}

export default function EmailConfirmation({
      setResponseState,
    }: EmailConfirmationProps) {
    const navigate = useNavigate();

    const {
        handleSubmit,
        setValue,
        formState: {errors, isSubmitting},
    } = useForm<EmailConfirmationSchema>({
        resolver: zodResolver(emailConfirmationSchema),
        defaultValues: {
            code: "",
        },
    });

    const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleInputChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newCode = [...code];
        newCode[index] = value.slice(-1);
        setCode(newCode);
        setValue("code", newCode.join(""));

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text").slice(0, 6);
        if (!/^\d+$/.test(pastedData)) return;

        const newCode = [...code];
        for (let i = 0; i < pastedData.length; i++) {
            newCode[i] = pastedData[i];
        }
        setCode(newCode);
        setValue("code", newCode.join(""));

        const nextEmptyIndex = Math.min(pastedData.length, 5);
        inputRefs.current[nextEmptyIndex]?.focus();
    };

    const onSubmit = async (data: EmailConfirmationSchema) => {
        try {
            const res = await executeConfirmEmailRequest(data.code);
            const json = await res.json();

            if (res.status !== 200) {
                setResponseState({
                    message: json.message,
                    isError: true,
                });

                return;
            }

            const emailConfirmed: boolean = json.emailConfirmed;

            setResponseState({
                message: emailConfirmed
                    ? "Email confirmed successfully!"
                    : "Email confirmation failed!",
                isError: !emailConfirmed,
            });

            navigate("/login");
        } catch {
            setResponseState({
                message: "Oops! Something went wrong. Please try again later.",
                isError: true,
            });
        }
    };

    return (
        <div className="w-full flex justify-center items-center mt-5">
            <form
                className="bg-white shadow-2xl rounded-2xl py-10 px-20 space-y-7 w-1/3 md:w-1/2 sm:w-full"
                onSubmit={handleSubmit(onSubmit)}
            >
                <img
                    className="w-40 mx-auto mb-4"
                    src="/mossy_logo.png"
                    alt="Mossy Logo"
                />

                <h1 className="text-4xl font-bold text-center text-emerald-800 mb-1">
                    Confirm your email
                </h1>

                <p className="block text-sm font-medium text-gray-700 mb-2 text-center">
                    Enter verification code
                </p>

                <div>
                    <div className="flex justify-center gap-2 sm:gap-1 mt-5">
                        {code.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => {
                                    inputRefs.current[index] = el;
                                }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleInputChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onPaste={handlePaste}
                                className="w-12 h-14 sm:w-10 sm:h-12 text-center text-2xl font-bold border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors duration-300"
                            />
                        ))}
                    </div>

                    <AnimatePresence>
                        {errors.code && (
                            <motion.p
                                initial={{opacity: 0, height: 0}}
                                animate={{opacity: 1, height: "auto"}}
                                exit={{opacity: 0, height: 0}}
                                className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md"
                            >
                                {errors.code.message}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </div>

                <RippleButton
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400
          text-white font-semibold py-3 px-6 rounded-lg transition-all
          duration-300 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
                >
                    {isSubmitting ? (
                        <motion.span
                            animate={{opacity: [1, 0.5, 1]}}
                            transition={{duration: 1.5, repeat: Infinity}}
                        >
                            Signing up...
                        </motion.span>
                    ) : (
                        "Take control"
                    )}
                </RippleButton>
            </form>
        </div>
    );
}