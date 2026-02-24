import {Link} from "react-router";

interface NavTabProps {
    name: string
    url: string
    id: number
    activeId: number
    setActiveTab: any
}

function NavTab({ name, url, id, activeId, setActiveTab }: NavTabProps) {
    const isActive = () => activeId === id

    return (
        <section className={(isActive() ? "border-b-green-900 border-b-4" : "") + " flex flex-col justify-center items-center h-full"}>
            <Link
                to={url}
                className={(isActive() ? "font-bold" : "font-normal") + " text-justify text-l"}
                onClick={() => setActiveTab(id)}
            >
                {name}
            </Link>
        </section>
    )
}

export default NavTab