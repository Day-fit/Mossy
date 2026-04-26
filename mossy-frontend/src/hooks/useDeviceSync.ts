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
import { PinNotFoundException } from '../exception/PinNotFoundException.ts';

export type UseDeviceSyncResult = {
	nonce: string | null;
	isConnected: boolean;
	error: string | null;
	connect: (
		wsUrl: string,
		role: KeySyncRole,
		syncCode: string,
		pin?: string
	) => Promise<void>;
	disconnect: () => void;
	resumeWithPin: (pin: string) => Promise<void>;
	initializeKeySync: (vaultId: string) => Promise<string>;
};

export type JWKFormat = {
	kty: 'OKP';
	crv: 'X25519' | 'Ed25519';
	x: string;
};

type KeySyncMessage = {
	type: 'KEY_SYNC';
	ciphertext: string;
	nonce: string;
	signature: string;
	vaultId: string;
};

type PeerDetailsMessage = {
	type: 'PEER_DETAILS';
	peerIdKey: string;
	peerDhKey: string;
	vaultId: string;
};

export type KeySyncRole = 'SENDER' | 'RECEIVER';

type PeerInfo = {
	mutualSecret: Uint8Array;
	peerIdPublicKey: Uint8Array;
	vaultId: string;
};

export function useDeviceSync(): UseDeviceSyncResult {
	const deviceId = useDeviceStore((state) => state.deviceId);
	const { generateDhKey, idKey } = useDeviceKeys();
	const { loadKey, saveRawKey } = useEncryptionHook();

	const wsRef = useRef<WebSocket | null>(null);
	const connectionPromiseRef = useRef<Promise<void> | null>(null);
	const isConnectedRef = useRef(false);
	const peerInfo = useRef<PeerInfo | null>(null);
	const pendingResumeRef = useRef<KeySyncRole | null>(null);

	const [nonce, setNonce] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const initializeKeySync = async (vaultId: string) => {
		if (!deviceId) {
			throw new Error(
				'Device ID not found. Please register device first.'
			);
		}

		try {
			const response = await executeInitKeySyncRequest(deviceId, vaultId);
			return response.code;
		} catch (error: any) {
			setError(error?.message ?? 'Key sync initialization failed');
			throw error;
		}
	};

	const disconnect = () => {
		if (wsRef.current) {
			wsRef.current.close();
			wsRef.current = null;
		}

		isConnectedRef.current = false;
		peerInfo.current = null;
		pendingResumeRef.current = null;
	};

	const buildAuthFrame = async (wsUrl: string, syncCode: string) => {
		const currentDeviceId = useDeviceStore.getState().deviceId;

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

		if (!syncCode) {
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

		if (!idKey.private) {
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
			? `${wsUrl}&syncCode=${syncCode}`
			: `${wsUrl}?syncCode=${syncCode}`;

		return {
			wsUrlWithCode,
			userDhPair: dhKey,
			deviceId: currentDeviceId,
			signature: signatureB64,
		};
	};

	const receiveKey = (pin: string): Promise<void> => {
		const currentWs = wsRef.current;
		const currentPeerInfo = peerInfo.current;

		if (!currentPeerInfo)
			return Promise.reject(new Error('Missing peer info'));
		if (!idKey) return Promise.reject(new Error('Missing idKey'));
		if (!currentWs || currentWs.readyState !== WebSocket.OPEN) {
			return Promise.reject(new Error('WebSocket not connected'));
		}

		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(
				() => reject(new Error('Timeout waiting for KEY_SYNC')),
				300000
			);

			const cleanup = () => clearTimeout(timeoutId);

			currentWs.onerror = () => {
				cleanup();
				reject(new Error('WebSocket error while waiting for KEY_SYNC'));
			};

			currentWs.onmessage = (event) => {
				try {
					const data: KeySyncMessage = JSON.parse(event.data);
					if (data.type !== 'KEY_SYNC') return;

					cleanup();

					const expectedPayload = new Uint8Array([
						...sodium.from_base64(data.ciphertext),
						...sodium.from_string(data.vaultId),
						...currentPeerInfo.peerIdPublicKey,
					]);

					const isSignatureValid = sodium.crypto_sign_verify_detached(
						sodium.from_base64(data.signature),
						expectedPayload,
						currentPeerInfo.peerIdPublicKey
					);

					if (!isSignatureValid) {
						reject(
							new Error('Received key with invalid signature')
						);
						return;
					}

					const rawKey = sodium.crypto_secretbox_open_easy(
						sodium.from_base64(data.ciphertext),
						sodium.from_base64(
							data.nonce,
							sodium.base64_variants.URLSAFE
						),
						currentPeerInfo.mutualSecret
					);

					void saveRawKey(data.vaultId, pin, new Uint8Array(rawKey));
					resolve();
				} catch (err) {
					cleanup();
					reject(err);
				}
			};
		});
	};

	const sendKey = async (pinOverwrite?: string) => {
		const currentWs = wsRef.current;
		const currentPeerInfo = peerInfo.current;

		if (!currentPeerInfo) {
			return;
		}

		const vaultId = currentPeerInfo.vaultId;
		const pin = pinOverwrite ?? useEncryptionStore.getState().pins[vaultId];

		if (!pin) {
			throw new PinNotFoundException(
				vaultId,
				'Pin not found for vaultId:'
			);
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

		const ciphertext = sodium.crypto_secretbox_easy(
			key,
			nonce,
			currentPeerInfo.mutualSecret
		);

		const currentIdKey = useDeviceStore.getState().idKey;

		if (!currentIdKey) {
			throw new Error(
				'One of the keys is missing. Please generate keys first.'
			);
		}

		const privateIdKey = sodium.from_base64(
			currentIdKey.private,
			sodium.base64_variants.URLSAFE_NO_PADDING
		);

		const publicIdKey = sodium.from_base64(
			currentIdKey.public,
			sodium.base64_variants.URLSAFE_NO_PADDING
		);

		const payload = new Uint8Array([
			...ciphertext,
			...sodium.from_string(vaultId),
			...publicIdKey,
		]);

		const signature = sodium.crypto_sign_detached(payload, privateIdKey);

		const message: KeySyncMessage = {
			type: 'KEY_SYNC',
			ciphertext: sodium.to_base64(ciphertext),
			nonce: sodium.to_base64(nonce),
			signature: sodium.to_base64(signature),
			vaultId,
		};

		currentWs.send(JSON.stringify(message));
	};

	const calculateMutualSecret = async (privateDhKey: string) => {
		const currentWs = wsRef.current;

		if (!currentWs) {
			throw new Error('WebSocket is not connected');
		}

		await sodium.ready;

		await new Promise<void>((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				reject(new Error('Timeout waiting for PEER_DETAILS'));
			}, 300000);

			currentWs.onmessage = (event) => {
				try {
					const data: PeerDetailsMessage = JSON.parse(event.data);

					if (data.type !== 'PEER_DETAILS') {
						return;
					}

					clearTimeout(timeoutId);

					const peerIdPublicKey = sodium.from_base64(
						data.peerIdKey,
						sodium.base64_variants.URLSAFE_NO_PADDING
					);

					const peerPublicDhKey = sodium.from_base64(
						data.peerDhKey,
						sodium.base64_variants.URLSAFE_NO_PADDING
					);

					const userPrivateDh = sodium.from_base64(
						privateDhKey,
						sodium.base64_variants.URLSAFE_NO_PADDING
					);

					peerInfo.current = {
						mutualSecret: sodium.crypto_scalarmult(
							userPrivateDh,
							peerPublicDhKey
						),
						peerIdPublicKey,
						vaultId: data.vaultId,
					};

					resolve();
				} catch (error) {
					clearTimeout(timeoutId);
					reject(error);
				}
			};

			currentWs.onerror = () => {
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
				const ws = new WebSocket(wsUrl);

				const jwkPublicDh: JWKFormat = {
					crv: 'X25519',
					kty: 'OKP',
					x: publicDh,
				};

				const fail = (err: unknown) => {
					disconnect();

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
				reject(
					err instanceof Error
						? err
						: new Error('Invalid WebSocket URL')
				);
			}
		});

	const resumeWithPin = async (pin: string): Promise<void> => {
		const pendingRole = pendingResumeRef.current;

		if (!pendingRole) {
			return;
		}

		if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
			throw new Error('WebSocket not connected');
		}

		if (!peerInfo.current) {
			throw new Error('Peer info not available');
		}

		pendingResumeRef.current = null;

		if (pendingRole !== 'SENDER') {
			throw new Error('Invalid resume role, only sender can resume');
		}

		await sendKey(pin);
	};

	const connect = async (
		wsUrl: string,
		syncRole: KeySyncRole,
		syncCode: string,
		pin?: string
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

		if (!pin && syncRole === 'RECEIVER') {
			throw Error('Pin is required for receiver');
		}

		connectionPromiseRef.current = (async () => {
			try {
				const { wsUrlWithCode, deviceId, signature, userDhPair } =
					await buildAuthFrame(wsUrl, syncCode);

				await connectToWs(
					wsUrlWithCode,
					deviceId,
					signature,
					userDhPair.public
				);

				await calculateMutualSecret(userDhPair.private);

				pendingResumeRef.current = syncRole;

				syncRole === 'RECEIVER'
					? await receiveKey(pin!)
					: await sendKey();

				pendingResumeRef.current = null;
			} catch (error) {
				if (error instanceof PinNotFoundException) {
					throw error;
				}

				disconnect();
				throw error;
			} finally {
				connectionPromiseRef.current = null;
			}
		})();

		return connectionPromiseRef.current;
	};

	useEffect(() => {
		return () => {
			disconnect();
		};
	}, []);

	return {
		nonce,
		isConnected: isConnectedRef.current,
		error,
		connect,
		disconnect,
		resumeWithPin,
		initializeKeySync,
	};
}
