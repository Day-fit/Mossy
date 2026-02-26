import Nav from "./ui/layout/Nav.tsx";
import Footer from "./ui/layout/Footer.tsx";
import SignupForm from "./ui/auth/SignupForm.tsx";

export default function Register() {
    return <>
        <Nav></Nav>
        <SignupForm></SignupForm>
        <Footer></Footer>
    </>
}