import { useState } from "react"

function Settings()
{
    const [toggled, setToggled] = useState(false);

    return (
        <div className="m-5 justify-center">
        <button className="cursor-pointer" onClick={() => setToggled(!toggled)}>Settings</button>
        { toggled && (
            <div className="flex flex-col">
                <ul>
                    <li>change sth</li>
                    <li>tht</li>
                </ul>
            </div>
        )}
        </div>
    )
}

export default Settings