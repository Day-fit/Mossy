interface VaultProps {
    name: string;
    lastUsed?: string;
}

function Vault({ name, lastUsed }: VaultProps)
{
    return (
        <div className="bg-green-900">
            <h2>{name}</h2>
            { lastUsed && 
            (
                <p>{lastUsed}</p>
            )}
        </div>
    )
}

export default Vault