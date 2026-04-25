import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useDeviceSync } from '../../hooks/useDeviceSync.ts';
import { useDeviceStore } from '../../store/deviceStore.ts';
import PasswordPinModal from '../shared/PasswordPinModal.tsx';
import { PinNotFoundException } from '../../exception/PinNotFoundException.ts';

export default function KeySyncHero() {
	const { code } = useParams();
	const { connect, resumeWithPin } = useDeviceSync(code);
	const [vaultId, setVaultId] = useState<string | undefined>(undefined);
	const [isPinModalActive, setIsPinModalActive] = useState(false);
	const deviceId = useDeviceStore((state) => state.deviceId);
	const navigate = useNavigate();

	useEffect(() => {
		if (!code?.match(/^[0-9]{6}$/)) {
			navigate('/dashboard');
			return;
		}

		if (!deviceId) {
			return;
		}

		connect('/api/v1/ws/key-sync', 'SENDER').catch((ex) => {
			if (ex instanceof PinNotFoundException) {
				setVaultId(ex.vaultId);
				setIsPinModalActive(true);
			}
		});
	}, [code, deviceId]);

	return (
		<>
			<h1>Sender used code {code}</h1>
			{isPinModalActive && (
				<PasswordPinModal
					setIsPinModalActive={setIsPinModalActive}
					vaultId={vaultId}
					afterPinEntered={(pin) => {
						void resumeWithPin(pin);
					}}
				/>
			)}
		</>
	);
}
