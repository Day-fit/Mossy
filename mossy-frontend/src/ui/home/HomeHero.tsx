import RippleButton from '../layout/RippleButton.tsx';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.ts';

function HomeHero() {
	const navigate = useNavigate();
	const { isAuthenticated } = useAuth();

	return (
		<section className="bg-[url('/hero.png')] bg-cover bg-bottom bg-no-repeat w-full p-6 sm:p-10 md:p-20 lg:p-30 drop-shadow-xl/25">
			<div className="max-w-full sm:max-w-[80%] md:max-w-[60%] lg:max-w-[40%]">
				<h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-4xl mb-4">
					An open-source password manager that never wants your
					secrets
				</h1>
				<p className="text-xs sm:text-sm md:text-sm mb-6">
					A self-hosted vault running on your infrastructure. The
					project exists only as a transport and key-sync layer.
					Passwords never leave your server.
				</p>
			</div>

			<div className="flex flex-col sm:flex-row gap-2 sm:gap-0">
				{!isAuthenticated ? (
					<>
						<RippleButton
							className="sm:mr-1"
							onClick={() => navigate('/register')}
						>
							Sign Up
						</RippleButton>
						<RippleButton
							variant={'outline'}
							rippleColor="rgb(0, 0, 0, 0.7)"
							onClick={() => navigate('/login')}
						>
							Sign In
						</RippleButton>
					</>
				) : (
					<RippleButton onClick={() => navigate('/dashboard')}>
						Go to dashboard
					</RippleButton>
				)}
			</div>
		</section>
	);
}

export default HomeHero;
