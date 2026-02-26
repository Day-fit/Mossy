import Nav from './ui/layout/Nav.tsx'
import HomeHero from "./ui/home/HomeHero.tsx";
import About from "./ui/home/About.tsx";
import Footer from "./ui/layout/Footer.tsx";

function Home() {
    return <div className="flex flex-col gap-3">
        <Nav></Nav>
        <HomeHero></HomeHero>
        <About></About>
        <Footer></Footer>
    </div>
}

export default Home