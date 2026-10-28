import HomeHero from '../ui/home/HomeHero.tsx';
import About from '../ui/home/About.tsx';
import HomeExtension from '../ui/home/HomeExtension.tsx';

function Home() {
    return (
        <div className="flex flex-col gap-3">
            <HomeHero></HomeHero>
            <HomeExtension />
            <About></About>
        </div>
    );
}

export default Home;
