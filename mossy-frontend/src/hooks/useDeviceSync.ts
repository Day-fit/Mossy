import { useEffect, useRef, useState } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import { executeInitKeySyncRequest } from '../api/device.api.ts';
import { useDeviceKey } from '../context/DeviceKeyContext.tsx';

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

export function useDeviceSync(): UseDeviceSyncResult {
	const { deviceKeys, deviceId } = useDeviceKey();
	const wsRef = useRef<WebSocket | null>(null);
	const connectionPromiseRef = useRef<Promise<void> | null>(null);
	const isConnectedRef = useRef(false);
	const initSyncAttemptedRef = useRef(false);

	const [nonce, setNonce] = useState<string | null>(null);
	const [syncCode, setSyncCode] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!deviceId || syncCode || initSyncAttemptedRef.current) {
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
				if (!deviceId) {
					throw new Error(
						'Device ID not found. Please register device first.'
					);
				}

				if (!deviceKeys) {
					throw new Error(
						'Device keys not found. Please generate device keys first.'
					);
				}

				if (!syncCode) {
					throw new Error(
						'Sync code not found. Please initialize key sync first.'
					);
				}

				await sodium.ready;

				const nonceResponse = await fetch(
					`${wsUrl.replace('ws', 'http')}/api/v1/key-sync/nonce`,
					{
						headers: {
							'X-Device-ID': deviceId,
						},
					}
				);

				if (!nonceResponse.ok) {
					throw new Error('Failed to get nonce');
				}

				const { nonce: nonceValue } = await nonceResponse.json();
				setNonce(nonceValue);

				const nonceBytes = sodium.from_base64(
					nonceValue,
					sodium.base64_variants.URLSAFE_NO_PADDING
				);

				const publicDhBytes = sodium.from_base64(
					deviceKeys.X25519.public,
					sodium.base64_variants.URLSAFE_NO_PADDING
				);

				const payload = new Uint8Array(
					publicDhBytes.length + nonceBytes.length
				);
				payload.set(publicDhBytes);
				payload.set(nonceBytes, publicDhBytes.length);

				const privateKeyBytes = sodium.from_base64(
					deviceKeys.Ed25519.private,
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

				const ws = new WebSocket(wsUrl);

				ws.onopen = () => {
					const authFrame = {
						type: 'AUTH_FRAME',
						deviceId: deviceId,
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
