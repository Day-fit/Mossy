import { type SubmitEventHandler, useState} from "react";
import StrengthMetter from "./StrengthMetter.tsx";

export default function PasswordHero()
{
    const [password, setPassword] = useState("");
    const handleSubmit: SubmitEventHandler<HTMLFormElement> = e => {
        e.preventDefault();
        setPassword("");
        e.target.reset();
        //TODO: Implement api communication
    };

    return (
        <section>
            <section className="w-full p-5">
                <form onSubmit={handleSubmit} className="flex gap-5">
                    <input type="text" name="domain" placeholder="Enter Domain" className="border-b-2"/>

                    <input type="password" name="password" placeholder="Enter Password" className="border-b-2"
                           onChange={
                               (e) => setPassword(e.target.value)
                           }
                    />
                    <StrengthMetter password={password}></StrengthMetter>
                    <button type="submit" className="border-2 rounded-sm pt-2 pb-2 pr-4 pl-4">Add</button>
                </form>
            </section>
        </section>
    )
}