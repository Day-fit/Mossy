import RippleButton from "../layout/RippleButton.tsx";
import * as React from "react";
import {useForm} from "react-hook-form";
import type {EncryptionPinSchema} from "../../forms/encryptionPinSchema.ts";

type PasswordPinModalProps = {
    setEncryptionPin: React.Dispatch<React.SetStateAction<string | undefined>>
};

export default function PasswordPinModal({
    setEncryptionPin
}: PasswordPinModalProps) {
    const {register, handleSubmit, formState: {errors, isSubmitting}} = useForm<EncryptionPinSchema>()

    return <div className="fixed h-screen inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
        <form onSubmit={handleSubmit(data => {
            setEncryptionPin(data.pin)
        })}
            className="bg-white shadow-md rounded-md w-2/3 h-3/4 flex flex-col items-center"
        >
            <h1 className={"text-3xl mt-5"}>Please type vault key pin to proceed</h1>

            <label className={"text-xl mt-5"}>Pin</label>


            <RippleButton className={"text-white"} type={"submit"} onClick={}>
                Continue
            </RippleButton>
        </form>
    </div>
}