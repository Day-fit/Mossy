import { useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';

export default function KeySyncHero() {
	const { code } = useParams();
	const navigate = useNavigate();

	useEffect(() => {
		if (code?.match(/^[0-9]{6}$/)) {
			return;
		}

		navigate('/dashboard');
	}, [code]);

	return (
		<>
			<h1>Sender used code {code}</h1>
		</>
	);
}
