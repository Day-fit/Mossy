import { useEffect, useRef, useState } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import {
	executeGenerateNonceRequest,
	executeInitKeySyncRequest,
} from '../api/device.api.ts';
import { useDeviceKey } from '../context/DeviceKeyContext.tsx';
import { useDeviceStore } from '../store/deviceStore.ts';

export type UseDeviceSyncResult = {
	isInitialized: boolean;
	nonce: string | null;
	syncCode: string | null;
	isConnected: boolean;
	error: string | null;
	connect: (wsUrl: string) => Promise<void>;
	disconnect: () => void;
	sendMessage: (payload: any) => void;
};

export function useDeviceSync(providedSyncCode?: string): UseDeviceSyncResult {
	const { deviceId } = useDeviceKey();
	const wsRef = useRef<WebSocket | null>(null);
	const connectionPromiseRef = useRef<Promise<void> | null>(null);
	const isConnectedRef = useRef(false);
	const initSyncAttemptedRef = useRef(false);

	const [nonce, setNonce] = useState<string | null>(null);
	const [syncCode, setSyncCode] = useState<string | null>(
		providedSyncCode || null
	);
	const [error, setError] = useState<string | null>(null);

	const syncCodeRef = useRef(providedSyncCode || syncCode);
	useEffect(() => {
		syncCodeRef.current = providedSyncCode || syncCode;
	}, [providedSyncCode, syncCode]);

	useEffect(() => {
		if (!deviceId || syncCodeRef.current || initSyncAttemptedRef.current) {
			return;
		}

		initSyncAttemptedRef.current = true;

		executeInitKeySyncRequest(deviceId)
			.then((response: any) => {
				setSyncCode(response.code);
			})
			.catch((error: any) => {
				console.error('Key sync initialization failed:', error);
				setError(error.message || 'Key sync initialization failed');
				initSyncAttemptedRef.current = false;
			});
	}, [deviceId, syncCode]);

	const disconnect = () => {
		if (wsRef.current) {
			wsRef.current.close();
			wsRef.current = null;
		}
		isConnectedRef.current = false;
	};

	const connect = async (wsUrl: string): Promise<void> => {
		if (connectionPromiseRef.current) {
			return connectionPromiseRef.current;
		}

		if (
			isConnectedRef.current &&
			wsRef.current?.readyState === WebSocket.OPEN
		) {
			return;
		}

		connectionPromiseRef.current = new Promise(async (resolve, reject) => {
			try {
				const currentDeviceId = useDeviceStore.getState().deviceId;
				const currentDeviceKeys = useDeviceStore.getState().deviceKeys;
				const currentSyncCode = syncCodeRef.current;

				if (!currentDeviceId) {
					throw new Error(
						'Device ID not found. Please register device first.'
					);
				}

				if (!currentDeviceKeys) {
					throw new Error(
						'Device keys not found. Please generate device keys first.'
					);
				}

				if (!currentSyncCode) {
					throw new Error(
						'Sync code not found. Please initialize key sync first.'
					);
				}

				await sodium.ready;

				const nonceResponse =
					await executeGenerateNonceRequest(currentDeviceId);

				setNonce(nonceResponse.nonce);

				const nonceBytes = sodium.from_base64(
					nonceResponse.nonce,
					sodium.base64_variants.URLSAFE
				);

				const publicDhBytes = sodium.from_base64(
					currentDeviceKeys.X25519.public,
					sodium.base64_variants.URLSAFE_NO_PADDING
				);

				const payload = new Uint8Array(
					publicDhBytes.length + nonceBytes.length
				);
				payload.set(publicDhBytes);
				payload.set(nonceBytes, publicDhBytes.length);

				const privateKeyBytes = sodium.from_base64(
					currentDeviceKeys.Ed25519.private,
					sodium.base64_variants.URLSAFE_NO_PADDING
				);

				const signature = sodium.crypto_sign_detached(
					payload,
					privateKeyBytes
				);

				const signatureB64 = sodium.to_base64(
					signature,
					sodium.base64_variants.URLSAFE_NO_PADDING
				);

				const wsUrlWithCode = wsUrl.includes('?')
					? `${wsUrl}&syncCode=${currentSyncCode}`
					: `${wsUrl}?syncCode=${currentSyncCode}`;

				const ws = new WebSocket(wsUrlWithCode);

				ws.onopen = () => {
					const authFrame = {
						type: 'AUTH_FRAME',
						deviceId: currentDeviceId,
						signature: signatureB64,
					};

					ws.send(JSON.stringify(authFrame));
				};

				ws.onerror = (error) => {
					disconnect();
					reject(new Error(`WebSocket error: ${error}`));
				};

				ws.onclose = () => {
					isConnectedRef.current = false;
					wsRef.current = null;
				};

				wsRef.current = ws;
				isConnectedRef.current = true;

				await new Promise<void>((authResolve, authReject) => {
					const timeout = setTimeout(() => {
						authReject(new Error('Authentication timeout'));
					}, 5000);

					ws.onmessage = (event) => {
						clearTimeout(timeout);

						if (
							event.data === 'unauthorized' ||
							event.data === 'not found' ||
							event.data === 'auth failed'
						) {
							authReject(new Error(event.data));
						} else {
							authResolve();
						}
					};
				});

				resolve();
			} catch (error) {
				disconnect();
				reject(error);
			} finally {
				connectionPromiseRef.current = null;
			}
		});

		return connectionPromiseRef.current;
	};

	const sendMessage = (payload: any) => {
		if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
			throw new Error('WebSocket not connected');
		}

		const message = {
			type: 'MESSAGE',
			payload,
		};

		wsRef.current.send(JSON.stringify(message));
	};

	useEffect(() => {
		return () => {
			disconnect();
		};
	}, []);

	return {
		isInitialized: !!syncCode,
		nonce: nonce,
		syncCode: syncCode,
		isConnected: isConnectedRef.current,
		error: error,
		connect,
		disconnect,
		sendMessage,
	};
}
