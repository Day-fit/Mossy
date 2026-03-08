import {GoDotFill} from "react-icons/go";

type VaultDashboardViewProps = {
    passwordsCount: number
    vaultName: string
    isOnline: boolean
}

export default function VaultDashboardView({passwordsCount, vaultName, isOnline}: VaultDashboardViewProps) {
    return <section className={"border-2 border-gray-200 rounded-md p-4 h-full aspect-square flex flex-col"}>
        <div className="flex justify-around items-center">
            <h3 className="text-4xl sm:text-3xl">{vaultName}</h3>

            <div className={"flex items-center"}>
                <GoDotFill className={`text-xl sm:text-2xl ${isOnline ? "text-green-500" : "text-red-500"}`}/>
                <h3 className="text-xs sm:text-sm">{isOnline ? "Online" : "Offline"}</h3>
            </div>
        </div>

        <h1 className="text-8xl sm:text-8xl text-right mt-auto">{passwordsCount}</h1>
    </section>
}