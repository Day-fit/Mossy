import Nav from "./ui/layout/Nav.tsx";
import Footer from "./ui/layout/Footer.tsx";
import {Outlet} from "react-router-dom";

export default function Layout() {
    return <>
        <Nav/>
        <Outlet/>
        <Footer/>
    </>
}