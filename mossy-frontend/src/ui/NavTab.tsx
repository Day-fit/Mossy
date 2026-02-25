import { NavLink } from "react-router-dom";

interface NavTabProps {
    name: string
    url: string
}

function NavTab({ name, url }: NavTabProps) {

    return (
        <section className={"flex flex-col justify-center items-center h-full"}>
            <NavLink
                to={url}
                className={({isActive}) => (isActive ? "font-bold border-b-green-600 border-b-2" : "font-normal") + " text-justify text-l"}
            >
                {name}
            </NavLink>
        </section>
    )
}

export default NavTab