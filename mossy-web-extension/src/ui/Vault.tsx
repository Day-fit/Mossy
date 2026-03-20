import {MdHome} from "react-icons/md";

interface VaultProps {
    name: string;
    lastUsed?: string;
    isUsed?: boolean;
}

function Vault({ name, lastUsed, isUsed = false }: VaultProps)
{
    return (
        <div className={
            (isUsed ? "bg-green-800 hover:bg-green-700" : "bg-green-900 hover:bg-green-800")
            + " rounded-sm p-2 flex items-center justify-between cursor-pointer"
        }>
            <div>
                <h2>name: {name}</h2>
                { lastUsed && <p>last used: {lastUsed}</p> }
            </div>

            { isUsed && <MdHome/> }
        </div>
    )
}

export default Vault