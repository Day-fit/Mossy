import Nav from '../ui/layout/Nav.tsx';
import Footer from '../ui/layout/Footer.tsx';
import { Outlet } from 'react-router-dom';

export default function Layout() {
    return (
        <div className="flex min-h-dvh flex-col">
            <Nav />
            <main className="flex flex-1 flex-col">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
