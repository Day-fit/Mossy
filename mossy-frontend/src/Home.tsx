import Nav from './ui/Nav'
import HomeHero from "./ui/HomeHero.tsx";
import About from "./ui/About.tsx";
import Footer from "./ui/Footer.tsx";

function Home() {
    return <div className="flex flex-col gap-3">
        <Nav></Nav>
        <HomeHero></HomeHero>
        <About></About>
        <Footer></Footer>
    </div>
}

export default Home