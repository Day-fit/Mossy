import Nav from '../ui/layout/Nav.tsx';
import Footer from '../ui/layout/Footer.tsx';
import { Outlet, useLocation } from 'react-router-dom';

export default function Layout() {
    const location = useLocation();
    return (
        <div className="flex min-h-dvh flex-col">
            <Nav key={location.key} />
            <main className="flex flex-1 flex-col">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
