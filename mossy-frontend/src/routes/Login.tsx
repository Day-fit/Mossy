import SigninHero from '../ui/signin/SigninHero.tsx';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useNavigate } from 'react-router-dom';

export default function Login() {
	const { isAuthenticated } = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		if (isAuthenticated) {
			navigate('/dashboard');
		}
	}, []);

	return (
		<>
			<SigninHero></SigninHero>
		</>
	);
}
