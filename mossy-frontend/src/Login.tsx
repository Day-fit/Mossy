import Nav from "./ui/layout/Nav.tsx";
import Footer from "./ui/layout/Footer.tsx";
import SigninHero from "./ui/signin/SigninHero.tsx";

export default function Login() {
    return <>
        <Nav></Nav>
        <SigninHero></SigninHero>
        <Footer></Footer>
    </>
}