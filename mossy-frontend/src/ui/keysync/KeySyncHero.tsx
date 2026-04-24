import { useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useDeviceSync } from '../../hooks/useDeviceSync.ts';
import { useDeviceStore } from '../../store/deviceStore.ts';

export default function KeySyncHero() {
	const { code } = useParams();
	const { connect } = useDeviceSync(code);
	const deviceId = useDeviceStore((state) => state.deviceId);
	const navigate = useNavigate();

	useEffect(() => {
		if (!code?.match(/^[0-9]{6}$/)) {
			navigate('/dashboard');
			return;
		}

		if (deviceId) {
			void connect('/api/v1/ws/key-sync', 'SENDER');
		}
	}, [code, deviceId, connect]);

	return (
		<>
			<h1>Sender used code {code}</h1>
		</>
	);
}
