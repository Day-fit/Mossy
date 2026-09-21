import { NavLink } from 'react-router-dom';

export default function Footer() {
    return (
        <footer className="flex border-t-2 border-border justify-around bg-surface-chrome p-5">
            <section className="flex flex-col">
                <h3 className="type-card-title mb-1">
                    Repository, bugs, ideas
                </h3>
                <a
                    target="_blank"
                    href="https://github.com/Day-fit/Mossy"
                    rel="noopener noreferrer"
                    className="type-body-sm text-fg-muted"
                >
                    Repository
                </a>
                <a
                    target="_blank"
                    href="https://github.com/Day-fit/Mossy/issues/new"
                    rel="noopener noreferrer"
                    className="type-body-sm text-fg-muted"
                >
                    Report a bug
                </a>
                <a
                    target="_blank"
                    href="https://github.com/Day-fit/Mossy/issues/new"
                    rel="noopener noreferrer"
                    className="type-body-sm text-fg-muted"
                >
                    Share your idea
                </a>
            </section>
            <section className="flex flex-col">
                <h3 className="type-card-title mb-1">Site map</h3>
                <NavLink to="/" className="type-body-sm text-fg-muted">
                    Home
                </NavLink>
                <NavLink to="/register" className="type-body-sm text-fg-muted">
                    Sign up
                </NavLink>
                <NavLink to="/login" className="type-body-sm text-fg-muted">
                    Sign in
                </NavLink>
                <NavLink to="/dashboard" className="type-body-sm text-fg-muted">
                    Dashboard
                </NavLink>
                <NavLink to="/passwords" className="type-body-sm text-fg-muted">
                    Passwords
                </NavLink>
            </section>
        </footer>
    );
}
