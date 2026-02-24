import Nav from './ui/Nav'
import Hero from "./ui/Hero.tsx";
import About from "./ui/About.tsx";

function Home() {
    return <div className="flex flex-col gap-3">
        <Nav></Nav>
        <Hero></Hero>
        <About></About>
    </div>
}

export default Home