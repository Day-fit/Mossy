import { useEffect, useRef } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import {
	executeGetDeviceIdentityKeyRequest,
	executeInitKeySyncRequest,
} from '../api/device.api.ts';
import { useDeviceStore } from '../store/deviceStore.ts';
import { useDeviceKeys } from './useDeviceKeys.ts';
import { useEncryptionHook } from './useEncryptionHook.ts';
import { useEncryptionStore } from '../store/encryptionStore.ts';
import { PinNotFoundException } from '../exception/PinNotFoundException.ts';
import SockJS from 'sockjs-client';
import { tokenStorage } from '../auth/tokenStorage.ts';
import {
	signKeySyncAuthTranscript,
	type KeySyncRole,
	verifyKeySyncAuthTranscript,
} from './keySyncProtocol.ts';

export type UseDeviceSyncResult = {
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

type PublicDhJwk = {
	kty: 'OKP';
	crv: 'X25519';
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
	peerDeviceId: string;
	peerDhKey: string;
	signature: string;
	vaultId: string;
};

type SignatureStatusMessage = {
	type: 'SIGNATURE_STATUS';
	signaturesAccepted: boolean;
};

type AuthFrameResponse = {
	status: 'FAILED' | 'NOT_FOUND' | 'SUCCEEDED';
	message?: string;
};

type ServerMessage =
	| KeySyncMessage
	| PeerDetailsMessage
	| SignatureStatusMessage
	| AuthFrameResponse
	| { message: string };

type MessageWaiter = {
	predicate: (message: ServerMessage) => boolean;
	resolve: (message: ServerMessage) => void;
	reject: (error: Error) => void;
	timeoutId: ReturnType<typeof setTimeout>;
};

export type { KeySyncRole } from './keySyncProtocol.ts';

type PeerInfo = {
	mutualSecret: Uint8Array;
	peerIdPublicKey: Uint8Array;
	vaultId: string;
};

export function useDeviceSync(): UseDeviceSyncResult {
	const deviceId = useDeviceStore((state) => state.deviceId);
	const { generateDhKey, idKey } = useDeviceKeys();
	const { loadKey, saveRawKey } = useEncryptionHook();

	const wsRef = useRef<InstanceType<typeof SockJS> | null>(null);
	const connectionPromiseRef = useRef<Promise<void> | null>(null);
	const peerInfo = useRef<PeerInfo | null>(null);
	const pendingResumeRef = useRef<KeySyncRole | null>(null);
	const initializedVaultsRef = useRef(new Map<string, string>());
	const messageQueueRef = useRef<ServerMessage[]>([]);
	const messageWaiterRef = useRef<MessageWaiter | null>(null);

	const initializeKeySync = async (vaultId: string) => {
		if (!deviceId) {
			throw new Error(
				'Device ID not found. Please register device first.'
			);
		}

		const response = await executeInitKeySyncRequest(vaultId);
		initializedVaultsRef.current.set(response.code, vaultId);
		return response.code;
	};

	const rejectMessageWaiter = (error: Error) => {
		const waiter = messageWaiterRef.current;
		if (!waiter) return;

		clearTimeout(waiter.timeoutId);
		messageWaiterRef.current = null;
		waiter.reject(error);
	};

	const clearConnectionState = () => {
		peerInfo.current = null;
		pendingResumeRef.current = null;
		initializedVaultsRef.current.clear();
		messageQueueRef.current = [];
	};

	const disconnect = () => {
		rejectMessageWaiter(new Error('Key-sync connection closed'));

		const ws = wsRef.current;
		wsRef.current = null;
		clearConnectionState();

		ws?.close();
	};

	const waitForMessage = <T extends ServerMessage>(
		predicate: (message: ServerMessage) => message is T,
		timeoutMessage: string
	): Promise<T> => {
		const queuedIndex = messageQueueRef.current.findIndex(predicate);
		if (queuedIndex >= 0) {
			return Promise.resolve(
				messageQueueRef.current.splice(queuedIndex, 1)[0] as T
			);
		}

		if (messageWaiterRef.current) {
			return Promise.reject(
				new Error('Another key-sync message is already pending')
			);
		}

		return new Promise<T>((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				messageWaiterRef.current = null;
				reject(new Error(timeoutMessage));
			}, 300000);

			messageWaiterRef.current = {
				predicate,
				resolve: (message) => resolve(message as T),
				reject,
				timeoutId,
			};
		});
	};

	const buildAuthFrame = async (
		wsUrl: string,
		role: KeySyncRole,
		syncCode: string
	) => {
		const currentDeviceId = useDeviceStore.getState().deviceId;
		const accessToken = tokenStorage.get();

		if (!currentDeviceId) {
			throw new Error(
				'Device ID not found. Please register device first.'
			);
		}

		if (!idKey?.private) {
			throw new Error(
				'One of the keys is missing. Please generate keys first.'
			);
		}

		if (!accessToken) {
			throw new Error('Access token not found. Please sign in again.');
		}

		if (!syncCode) {
			throw new Error(
				'Sync code not found. Please initialize key sync first.'
			);
		}

		const dhKey = await generateDhKey();

		const signature = await signKeySyncAuthTranscript(
			role,
			syncCode,
			currentDeviceId,
			dhKey.public,
			idKey.private
		);

		const wsUrlWithCode = wsUrl.includes('?')
			? `${wsUrl}&syncCode=${syncCode}`
			: `${wsUrl}?syncCode=${syncCode}`;

		return {
			wsUrlWithCode,
			userDhPair: dhKey,
			accessToken,
			signature,
		};
	};

	const receiveKey = async (pin: string): Promise<void> => {
		const currentWs = wsRef.current;
		const currentPeerInfo = peerInfo.current;

		if (!currentPeerInfo) throw new Error('Missing peer info');
		if (!currentWs || currentWs.readyState !== SockJS.OPEN) {
			throw new Error('WebSocket not connected');
		}
		await sodium.ready;

		const data = await waitForMessage(
			(message): message is KeySyncMessage =>
				'type' in message && message.type === 'KEY_SYNC',
			'Timeout waiting for KEY_SYNC'
		);
		if (data.vaultId !== currentPeerInfo.vaultId) {
			throw new Error('Received key for an unexpected vault');
		}

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
			throw new Error('Received key with invalid signature');
		}

		const rawKey = sodium.crypto_secretbox_open_easy(
			sodium.from_base64(data.ciphertext),
			sodium.from_base64(data.nonce, sodium.base64_variants.URLSAFE),
			currentPeerInfo.mutualSecret
		);

		await saveRawKey(data.vaultId, pin, new Uint8Array(rawKey));
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

		if (!currentWs || currentWs.readyState !== SockJS.OPEN) {
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

	const calculateMutualSecret = async (
		privateDhKey: string,
		role: KeySyncRole,
		syncCode: string
	) => {
		const currentWs = wsRef.current;

		if (!currentWs) {
			throw new Error('WebSocket is not connected');
		}

		const data = await waitForMessage(
			(message): message is PeerDetailsMessage =>
				'type' in message && message.type === 'PEER_DETAILS',
			'Timeout waiting for PEER_DETAILS'
		);
		let signatureAccepted = false;
		try {
			const expectedVaultId = initializedVaultsRef.current.get(syncCode);
			if (
				role === 'RECEIVER' &&
				(!expectedVaultId || data.vaultId !== expectedVaultId)
			) {
				throw new Error(
					'Key-sync room is bound to an unexpected vault'
				);
			}

			const identityKey = await executeGetDeviceIdentityKeyRequest(
				data.peerDeviceId
			);
			if (identityKey.kty !== 'OKP' || identityKey.crv !== 'Ed25519') {
				throw new Error('Peer identity key has an invalid format');
			}

			const peerRole: KeySyncRole =
				role === 'SENDER' ? 'RECEIVER' : 'SENDER';
			signatureAccepted = await verifyKeySyncAuthTranscript(
				peerRole,
				syncCode,
				data.peerDeviceId,
				data.peerDhKey,
				data.signature,
				identityKey.x
			);

			if (!signatureAccepted) {
				throw new Error('Peer DH key has an invalid signature');
			}

			const peerIdPublicKey = sodium.from_base64(
				identityKey.x,
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
		} finally {
			if (currentWs.readyState === SockJS.OPEN) {
				currentWs.send(
					JSON.stringify({
						type: 'SIGNATURE_STATUS',
						signatureAccepted,
					})
				);
			}
		}

		const status = await waitForMessage(
			(message): message is SignatureStatusMessage =>
				'type' in message && message.type === 'SIGNATURE_STATUS',
			'Timeout waiting for peer signature verification'
		);
		if (!status.signaturesAccepted) {
			throw new Error('The peer rejected this device signature');
		}
	};

	const connectToWs = (
		wsUrl: string,
		accessToken: string,
		signature: string,
		publicDh: string
	): Promise<void> =>
		new Promise((resolve, reject) => {
			try {
				const ws = new SockJS(wsUrl);

				const jwkPublicDh: PublicDhJwk = {
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
						wsRef.current = ws;
						ws.send(
							JSON.stringify({
								type: 'AUTH_FRAME',
								accessToken,
								signature,
								jwkPublicDh,
							})
						);

						resolve();
					} catch (err) {
						fail(err);
					}
				};

				ws.onmessage = (event) => {
					try {
						const message = JSON.parse(event.data) as ServerMessage;
						const waiter = messageWaiterRef.current;
						if (waiter?.predicate(message)) {
							clearTimeout(waiter.timeoutId);
							messageWaiterRef.current = null;
							waiter.resolve(message);
						} else {
							messageQueueRef.current.push(message);
						}
					} catch {
						fail(new Error('Received an invalid key-sync message'));
					}
				};

				ws.onerror = () => {
					fail(new Error('WebSocket error'));
				};

				ws.onclose = () => {
					if (wsRef.current !== ws) return;

					rejectMessageWaiter(
						new Error('Key-sync connection closed')
					);
					wsRef.current = null;
					clearConnectionState();
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

		if (!wsRef.current || wsRef.current.readyState !== SockJS.OPEN) {
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

		if (wsRef.current?.readyState === SockJS.OPEN) {
			return;
		}

		if (!pin && syncRole === 'RECEIVER') {
			throw Error('Pin is required for receiver');
		}

		connectionPromiseRef.current = (async () => {
			try {
				const { wsUrlWithCode, accessToken, signature, userDhPair } =
					await buildAuthFrame(wsUrl, syncRole, syncCode);

				await connectToWs(
					wsUrlWithCode,
					accessToken,
					signature,
					userDhPair.public
				);

				const authResponse = await waitForMessage(
					(message): message is AuthFrameResponse =>
						'status' in message,
					'Timeout waiting for key-sync authentication'
				);
				if (authResponse.status !== 'SUCCEEDED') {
					throw new Error(
						authResponse.message ?? 'Key-sync authentication failed'
					);
				}

				await calculateMutualSecret(
					userDhPair.private,
					syncRole,
					syncCode
				);

				pendingResumeRef.current = syncRole;

				if (syncRole === 'RECEIVER') {
					await receiveKey(pin!);
				} else {
					await sendKey();
				}

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

	const disconnectRef = useRef(disconnect);
	disconnectRef.current = disconnect;

	useEffect(() => {
		return () => {
			disconnectRef.current();
		};
	}, []);

	return {
		connect,
		disconnect,
		resumeWithPin,
		initializeKeySync,
	};
}
