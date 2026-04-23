import { useEffect, useRef, useState } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import {
	executeGenerateNonceRequest,
	executeInitKeySyncRequest,
} from '../api/device.api.ts';
import { useDeviceStore } from '../store/deviceStore.ts';
import { useDeviceKeys } from './useDeviceKeys.ts';

export type UseDeviceSyncResult = {
	isInitialized: boolean;
	nonce: string | null;
	syncCode: string | null;
	isConnected: boolean;
	error: string | null;
	connect: (wsUrl: string) => Promise<void>;
	disconnect: () => void;
	sendKey: (encodedKey: string) => void;
};

export type JWKFormat = {
	kty: 'OKP';
	crv: 'X25519' | 'Ed25519';
	x: string;
};

export function useDeviceSync(providedSyncCode?: string): UseDeviceSyncResult {
	const deviceId = useDeviceStore((state) => state.deviceId);
	const { generateDhKey } = useDeviceKeys();
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

	const buildAuthFrame = async (wsUrl: string) => {
		const currentDeviceId = useDeviceStore.getState().deviceId;
		const idKey = useDeviceStore.getState().idKey;
		const currentSyncCode = syncCodeRef.current;

		if (!currentDeviceId) {
			throw new Error(
				'Device ID not found. Please register device first.'
			);
		}

		if (!idKey) {
			throw new Error(
				'One of the keys is missing. Please generate keys first.'
			);
		}

		if (!currentSyncCode) {
			throw new Error(
				'Sync code not found. Please initialize key sync first.'
			);
		}

		await sodium.ready;

		const dhKey = await generateDhKey();

		const nonceResponse =
			await executeGenerateNonceRequest(currentDeviceId);
		setNonce(nonceResponse.nonce);

		const nonceBytes = sodium.from_base64(
			nonceResponse.nonce,
			sodium.base64_variants.URLSAFE
		);

		const publicDhBytes = sodium.from_base64(
			dhKey.public,
			sodium.base64_variants.URLSAFE_NO_PADDING
		);

		const payload = new Uint8Array(
			publicDhBytes.length + nonceBytes.length
		);

		payload.set(publicDhBytes, 0);
		payload.set(nonceBytes, publicDhBytes.length);

		if (!idKey?.private) {
			console.log('idKey:', idKey);
			throw new Error('Missing idKey.private');
		}

		const privateKeyBytes = sodium.from_base64(
			idKey.private,
			sodium.base64_variants.URLSAFE_NO_PADDING
		);

		const signature = sodium.crypto_sign_detached(payload, privateKeyBytes);

		const signatureB64 = sodium.to_base64(
			signature,
			sodium.base64_variants.URLSAFE_NO_PADDING
		);

		const wsUrlWithCode = wsUrl.includes('?')
			? `${wsUrl}&syncCode=${currentSyncCode}`
			: `${wsUrl}?syncCode=${currentSyncCode}`;

		return {
			wsUrlWithCode,
			publicDh: {
				kty: 'OKP',
				crv: 'X25519',
				x: dhKey.public,
			} as JWKFormat,
			deviceId: currentDeviceId,
			signature: signatureB64,
		};
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

		connectionPromiseRef.current = (async () => {
			try {
				const { wsUrlWithCode, deviceId, signature, publicDh } =
					await buildAuthFrame(wsUrl);

				await connectToWs(wsUrlWithCode, deviceId, signature, publicDh);
			} catch (error) {
				disconnect();
				throw error;
			} finally {
				connectionPromiseRef.current = null;
			}
		})();

		return connectionPromiseRef.current;
	};

	const connectToWs = (
		wsUrl: string,
		deviceId: string,
		signature: string,
		publicDh: JWKFormat
	): Promise<void> =>
		new Promise((resolve, reject) => {
			try {
				console.log('Connecting to WebSocket:', wsUrl);
				const ws = new WebSocket(wsUrl.toString());

				const fail = (err: unknown) => {
					disconnect();
					connectionPromiseRef.current = null;
					reject(
						err instanceof Error
							? err
							: new Error('WebSocket connection failed')
					);
				};

				ws.onopen = () => {
					try {
						ws.send(
							JSON.stringify({
								type: 'AUTH_FRAME',
								deviceId,
								signature,
								publicDh,
							})
						);

						wsRef.current = ws;
						isConnectedRef.current = true;
						connectionPromiseRef.current = null;
						resolve();
					} catch (err) {
						fail(err);
					}
				};

				ws.onerror = () => {
					fail(new Error('WebSocket error'));
				};

				ws.onclose = () => {
					isConnectedRef.current = false;
					wsRef.current = null;
				};
			} catch (err) {
				connectionPromiseRef.current = null;
				reject(
					err instanceof Error
						? err
						: new Error('Invalid WebSocket URL')
				);
			}
		});

	const sendKey = (encodedVaultKey: string) => {
		const dhKey = useDeviceStore.getState().dhKey;
		if (!dhKey) {
			throw new Error('DH key not found');
		}

		if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
			throw new Error('WebSocket not connected');
		}

		const message = {
			type: 'KeySync',
			cipherText: encodedVaultKey,
			publicDh: dhKey.public,
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
		sendKey,
	};
}
