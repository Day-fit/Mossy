import { useState } from "react"
import Vault from "./Vault"

function VaultPanel()
{
    const [toggled, setToggled] = useState(false)

    return (
        <div className="w-full p-5 bg-green-950">
            <h2>Current vault: </h2>
            <Vault name="Choosed Vault"/>
            <button onClick={() => setToggled(!toggled)}>Click to expand</button>
            { toggled && (
                <>
                    <Vault name="Other vault" lastUsed="Jan, 2026"/>
                    <Vault name="Last vault" lastUsed="Never"/>
                </>
            ) }
        </div>
    )
}

export default VaultPanel