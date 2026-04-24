import { useEffect, useRef, useState } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import {
	executeGenerateNonceRequest,
	executeInitKeySyncRequest,
} from '../api/device.api.ts';
import { useDeviceStore } from '../store/deviceStore.ts';
import { useDeviceKeys } from './useDeviceKeys.ts';
import { useEncryptionHook } from './useEncryptionHook.ts';
import { useEncryptionStore } from '../store/encryptionStore.ts';

export type UseDeviceSyncResult = {
	isInitialized: boolean;
	nonce: string | null;
	syncCode: string | null;
	isConnected: boolean;
	error: string | null;
	connect: (wsUrl: string, role: KeySyncRole) => Promise<void>;
	disconnect: () => void;
};

export type JWKFormat = {
	kty: 'OKP';
	crv: 'X25519' | 'Ed25519';
	x: string;
};

type KeySyncMessage = {
	type: 'KEY_SYNC';
	cipherText: string;
	nonce: string;
	signature: string;
	vaultId: string;
};

export type KeySyncRole = 'SENDER' | 'RECEIVER';

export function useDeviceSync(providedSyncCode?: string): UseDeviceSyncResult {
	const deviceId = useDeviceStore((state) => state.deviceId);
	const { generateDhKey, idKey } = useDeviceKeys();
	const { loadKey } = useEncryptionHook();
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
			userDhPair: dhKey,
			deviceId: currentDeviceId,
			signature: signatureB64,
		};
	};

	const connect = async (
		wsUrl: string,
		syncRole: KeySyncRole
	): Promise<void> => {
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
				const { wsUrlWithCode, deviceId, signature, userDhPair } =
					await buildAuthFrame(wsUrl);

				await connectToWs(
					wsUrlWithCode,
					deviceId,
					signature,
					userDhPair.public
				);
				const { mutualSecret, vaultId, peerIdKey } =
					await calculateMutualSecret(userDhPair.private);
				syncRole === 'SENDER'
					? await sendKey(mutualSecret, vaultId, peerIdKey)
					: await receiveKey(mutualSecret, peerIdKey);
			} catch (error) {
				disconnect();
				throw error;
			} finally {
				connectionPromiseRef.current = null;
			}
		})();

		return connectionPromiseRef.current;
	};

	const receiveKey = async (
		mutualSecret: Uint8Array,
		peerIdKey: Uint8Array
	) => {
		const currentWs = wsRef.current;

		if (currentWs == null || currentWs.readyState !== WebSocket.OPEN) {
			return;
		}

		await sodium.ready;

		currentWs.onmessage = (event) => {
			const data: KeySyncMessage = JSON.parse(event.data);

			if (idKey == null) {
				return;
			}

			const publicIdKey = sodium.from_base64(
				idKey.public,
				sodium.base64_variants.URLSAFE_NO_PADDING
			);

			const expectedPayload = new Uint8Array([
				...peerIdKey,
				...sodium.from_string(data.vaultId),
				...publicIdKey,
			]);

			const isSignatureValid = sodium.crypto_sign_verify_detached(
				sodium.from_base64(data.signature),
				expectedPayload,
				peerIdKey
			);

			if (!isSignatureValid) {
				throw new Error('Received key with invalid signature');
			}

			const decryptedKey = sodium.crypto_secretbox_open_easy(
				sodium.from_base64(data.cipherText),
				sodium.from_base64(data.nonce, sodium.base64_variants.URLSAFE),
				mutualSecret
			);

			//TODO: save key into crypto api
		};
	};

	const sendKey = async (
		mutualSecret: Uint8Array,
		vaultId: string,
		peerIdKey: Uint8Array
	) => {
		const currentWs = wsRef.current;
		const pin = useEncryptionStore.getState().pins[vaultId];
		if (!pin) {
			throw new Error('Pin needs to be set');
		}

		await sodium.ready;

		const rawKey = await loadKey(vaultId, pin);
		const exportedKey = await crypto.subtle.exportKey('raw', rawKey);
		const key = new Uint8Array(exportedKey);

		if (!currentWs || currentWs.readyState !== WebSocket.OPEN) {
			throw new Error('WebSocket not connected');
		}

		const nonce = sodium.randombytes_buf(
			sodium.crypto_secretbox_NONCEBYTES
		);

		const cipherText = sodium.crypto_secretbox_easy(
			sodium.to_base64(key),
			mutualSecret,
			nonce
		);

		const idKey = useDeviceStore.getState().idKey;

		if (!idKey) {
			throw new Error(
				'One of the keys is missing. Please generate keys first.'
			);
		}

		const privateIdKey = sodium.from_base64(
			idKey.private,
			sodium.base64_variants.URLSAFE_NO_PADDING
		);

		const publicIdKey = sodium.from_base64(
			idKey.public,
			sodium.base64_variants.URLSAFE_NO_PADDING
		);

		const payload = new Uint8Array([
			...peerIdKey,
			...sodium.from_string(vaultId),
			...publicIdKey,
		]);

		const signature = sodium.crypto_sign_detached(payload, privateIdKey);

		const message = {
			type: 'KEY_SYNC',
			cipherText: sodium.to_base64(cipherText),
			nonce: sodium.to_base64(nonce),
			signature: sodium.to_base64(signature),
		};

		currentWs.send(JSON.stringify(message));
	};

	const calculateMutualSecret = async (
		privateDhKey: string
	): Promise<{
		mutualSecret: Uint8Array;
		peerIdKey: Uint8Array;
		vaultId: string;
	}> => {
		const currentWs = wsRef.current;

		await sodium.ready;

		if (!currentWs) {
			throw new Error('WebSocket is not connected');
		}

		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				reject(new Error('Timeout waiting for PEER_DETAILS'));
			}, 10000);

			currentWs.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);

					if (data.type !== 'PEER_DETAILS') {
						return;
					}

					clearTimeout(timeoutId);

					const peerPublicDh = sodium.from_base64(
						data.peerPublicDh,
						sodium.base64_variants.URLSAFE_NO_PADDING
					);

					const userPrivateDh = sodium.from_base64(
						privateDhKey,
						sodium.base64_variants.URLSAFE_NO_PADDING
					);

					const mutualSecret = sodium.crypto_scalarmult(
						userPrivateDh,
						peerPublicDh
					);

					const vaultId = data.vaultId;

					resolve({
						mutualSecret,
						peerIdKey: sodium.from_base64(data.peerIdKey),
						vaultId,
					});
				} catch (error) {
					clearTimeout(timeoutId);
					reject(error);
				}
			};

			currentWs.onerror = (_) => {
				clearTimeout(timeoutId);
				reject(
					new Error('WebSocket error while waiting for PEER_DETAILS')
				);
			};
		});
	};

	const connectToWs = (
		wsUrl: string,
		deviceId: string,
		signature: string,
		publicDh: string
	): Promise<void> =>
		new Promise((resolve, reject) => {
			try {
				console.log('Connecting to WebSocket:', wsUrl);
				const ws = new WebSocket(wsUrl.toString());
				const jwkPublicDh: JWKFormat = {
					crv: 'X25519',
					kty: 'OKP',
					x: publicDh,
				};

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
								jwkPublicDh,
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
	};
}
