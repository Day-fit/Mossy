import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import DevicesHero from '../ui/devices/DevicesHero.tsx';

export default function Devices() {
	const { isAuthenticated } = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		if (isAuthenticated === false) navigate('/login');
	}, [isAuthenticated, navigate]);

	if (isAuthenticated !== true) return null;
	return <DevicesHero />;
}
