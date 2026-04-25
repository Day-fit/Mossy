import { useState } from "react"
import {MdSettings} from "react-icons/md";

function Settings()
{
    const [toggled, setToggled] = useState(false);

    return (
        <div className="flex flex-col items-end justify-start m-5">
            <MdSettings size={24} onClick={() => setToggled(!toggled)} className="cursor-pointer"/>
            <div className={(toggled? "visible " : "invisible ") + "flex flex-col"}>
                <ul className="cursor-pointer">
                    <li>Lorem</li>
                    <li>Ipsum</li>
                </ul>
            </div>
        </div>
    )
}

export default Settings