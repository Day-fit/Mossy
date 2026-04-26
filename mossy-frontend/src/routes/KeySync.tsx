import KeySyncHero from '../ui/keysync/KeySyncHero.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function KeySync() {
	const { isAuthenticated } = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		if (isAuthenticated === false) {
			navigate('/login');
		}
	}, [isAuthenticated, navigate]);

	if (isAuthenticated !== true) {
		return null;
	}

	return (
		<>
			<KeySyncHero />
		</>
	);
}
