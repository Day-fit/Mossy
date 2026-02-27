import Nav from "./ui/layout/Nav.tsx";
import Footer from "./ui/layout/Footer.tsx";
import SignupHero from "./ui/auth/SignupHero.tsx";

export default function Register() {
    return <>
        <Nav></Nav>
        <SignupHero></SignupHero>
        <Footer></Footer>
    </>
}