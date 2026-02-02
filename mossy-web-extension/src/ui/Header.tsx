import Settings from "./Settings"

function Header()
{
    return (
        <div className="flex justify-center-safe">
        <div className="flex items-center justify-around m-4">
            <img src="/icons/mossy_logo_128.png" alt="Mossy logo"/>
            <p>Your Password Manager</p>
        </div>
        <Settings></Settings>
        </div>
    )
}

export default Header