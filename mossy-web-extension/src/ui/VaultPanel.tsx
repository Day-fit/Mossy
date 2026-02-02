import { useState } from "react"
import Vault from "./Vault"

function VaultPanel()
{
    const [toggled, setToggled] = useState(false)

    return (
        <div className="w-full p-2 bg-green-950 rounded-sm">
            <h2>Current vault: </h2>
            <Vault name="Choosed Vault" isUsed={true}/>
            <button onClick={() => setToggled(!toggled)} className="cursor-pointer">Click to expand</button>
            {
                toggled &&
                <div className="flex flex-col gap-1">
                    <Vault name="Other vault" lastUsed="Jan, 2026"/>
                    <Vault name="Last vault" lastUsed="Never"/>
                </div>
            }
        </div>
    )
}

export default VaultPanel