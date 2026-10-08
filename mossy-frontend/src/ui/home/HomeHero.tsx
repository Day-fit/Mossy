import Button from '../shared/Button.tsx';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.ts';

function HomeHero() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    return (
        <section className="mt-6 grid w-full items-center gap-8 bg-surface px-6 py-10 shadow-card sm:mt-10 sm:px-10 md:grid-cols-2 md:px-12 md:py-16 lg:px-20">
            <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl md:text-4xl leading-tight mb-6">
                    An open-source password manager that never wants your
                    secrets
                </h1>
                <p className="mb-8 max-w-lg text-base leading-relaxed text-fg-secondary">
                    A self-hosted vault running on your infrastructure. The
                    project exists only as a transport and key-sync layer.
                    Passwords never leave your server.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                    {!isAuthenticated ? (
                        <>
                            <Button onClick={() => navigate('/register')}>
                                Sign Up
                            </Button>
                            <Button
                                variant={'outline'}
                                onClick={() => navigate('/login')}
                            >
                                Sign In
                            </Button>
                        </>
                    ) : (
                        <Button onClick={() => navigate('/dashboard')}>
                            Go to dashboard
                        </Button>
                    )}
                </div>
            </div>
            <img
                src="/illustrations/mossy-vault.svg"
                width="740"
                height="520"
                className="mx-auto block h-auto w-full max-w-xl"
                alt="Your devices exchange encrypted messages through Mossy with the vault on your own server."
            />
        </section>
    );
}

export default HomeHero;
