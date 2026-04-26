import { useEffect, useRef, useState } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import { executeGenerateNonceRequest, executeInitKeySyncRequest } from '../api/device.api';
import { useDeviceStore } from '../store/deviceStore';
import { useDeviceKeys } from './useDeviceKeys';
import { useEncryptionHook } from './useEncryptionHook';

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

type PeerInfo = {
  mutualSecret: Uint8Array;
  peerIdPublicKey: Uint8Array;
  vaultId: string;
};

type JwkPublicDh = {
  kty: 'OKP';
  crv: 'X25519';
  x: string;
};

export function useDeviceSync() {
  const deviceId = useDeviceStore((state) => state.deviceId);
  const { generateDhKey, idKey } = useDeviceKeys();
  const { saveRawKey } = useEncryptionHook();

  const wsRef = useRef<WebSocket | null>(null);
  const connectionPromiseRef = useRef<Promise<void> | null>(null);
  const peerInfo = useRef<PeerInfo | null>(null);
  const isConnectedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const initializeKeySync = async (vaultId: string) => {
    if (!deviceId) throw new Error('Device ID not found. Please register device first.');

    try {
      const response = await executeInitKeySyncRequest(deviceId, vaultId);
      return response.code;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Key sync initialization failed';
      setError(message);
      throw e;
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    peerInfo.current = null;
    isConnectedRef.current = false;
  };

  const buildAuthFrame = async (wsUrl: string, syncCode: string) => {
    const currentDeviceId = useDeviceStore.getState().deviceId;
    if (!currentDeviceId) throw new Error('Device ID not found. Please register device first.');
    if (!idKey?.private) throw new Error('Missing id key');
    if (!syncCode) throw new Error('Sync code not found');

    await sodium.ready;

    const dhKey = await generateDhKey();
    const nonceResponse = await executeGenerateNonceRequest(currentDeviceId);
    const nonceBytes = sodium.from_base64(nonceResponse.nonce, sodium.base64_variants.URLSAFE);
    const publicDhBytes = sodium.from_base64(dhKey.public, sodium.base64_variants.URLSAFE_NO_PADDING);

    const payload = new Uint8Array(publicDhBytes.length + nonceBytes.length);
    payload.set(publicDhBytes, 0);
    payload.set(nonceBytes, publicDhBytes.length);

    const privateIdKey = sodium.from_base64(idKey.private, sodium.base64_variants.URLSAFE_NO_PADDING);
    const signature = sodium.crypto_sign_detached(payload, privateIdKey);
    const signatureB64 = sodium.to_base64(signature, sodium.base64_variants.URLSAFE_NO_PADDING);
    const wsUrlWithCode = wsUrl.includes('?') ? `${wsUrl}&syncCode=${syncCode}` : `${wsUrl}?syncCode=${syncCode}`;

    return {
      wsUrlWithCode,
      deviceId: currentDeviceId,
      signature: signatureB64,
      userDhPair: dhKey,
    };
  };

  const connectToWs = async (wsUrl: string, currentDeviceId: string, signature: string, publicDh: string) =>
    new Promise<void>((resolve, reject) => {
      try {
        const ws = new WebSocket(wsUrl);
        const jwkPublicDh: JwkPublicDh = { kty: 'OKP', crv: 'X25519', x: publicDh };

        const fail = (err: unknown) => {
          disconnect();
          reject(err instanceof Error ? err : new Error('WebSocket connection failed'));
        };

        ws.onopen = () => {
          try {
            ws.send(
              JSON.stringify({
                type: 'AUTH_FRAME',
                deviceId: currentDeviceId,
                signature,
                jwkPublicDh,
              })
            );

            wsRef.current = ws;
            isConnectedRef.current = true;
            resolve();
          } catch (e) {
            fail(e);
          }
        };

        ws.onerror = () => fail(new Error('WebSocket error'));
        ws.onclose = () => {
          isConnectedRef.current = false;
          wsRef.current = null;
        };
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Invalid WebSocket URL'));
      }
    });

  const calculateMutualSecret = async (privateDhKey: string) => {
    const ws = wsRef.current;
    if (!ws) throw new Error('WebSocket not connected');

    await sodium.ready;

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('Timeout waiting for PEER_DETAILS')), 300000);

      ws.onmessage = (event) => {
        try {
          const data: PeerDetailsMessage = JSON.parse(event.data);
          if (data.type !== 'PEER_DETAILS') return;

          clearTimeout(timeoutId);

          const peerIdPublicKey = sodium.from_base64(data.peerIdKey, sodium.base64_variants.URLSAFE_NO_PADDING);
          const peerPublicDhKey = sodium.from_base64(data.peerDhKey, sodium.base64_variants.URLSAFE_NO_PADDING);
          const userPrivateDh = sodium.from_base64(privateDhKey, sodium.base64_variants.URLSAFE_NO_PADDING);

          peerInfo.current = {
            mutualSecret: sodium.crypto_scalarmult(userPrivateDh, peerPublicDhKey),
            peerIdPublicKey,
            vaultId: data.vaultId,
          };
          resolve();
        } catch (e) {
          clearTimeout(timeoutId);
          reject(e);
        }
      };

      ws.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error('WebSocket error while waiting for PEER_DETAILS'));
      };
    });
  };

  const receiveKey = async (pin: string) => {
    const ws = wsRef.current;
    const currentPeerInfo = peerInfo.current;
    if (!ws || !currentPeerInfo) throw new Error('Connection not ready');

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('Timeout waiting for KEY_SYNC')), 300000);

      const cleanup = () => clearTimeout(timeoutId);

      ws.onerror = () => {
        cleanup();
        reject(new Error('WebSocket error while waiting for KEY_SYNC'));
      };

      ws.onmessage = (event) => {
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
            reject(new Error('Received key with invalid signature'));
            return;
          }

          const rawKey = sodium.crypto_secretbox_open_easy(
            sodium.from_base64(data.ciphertext),
            sodium.from_base64(data.nonce, sodium.base64_variants.URLSAFE),
            currentPeerInfo.mutualSecret
          );

          void saveRawKey(data.vaultId, pin, new Uint8Array(rawKey)).then(() => resolve(), reject);
        } catch (e) {
          cleanup();
          reject(e);
        }
      };
    });
  };

  const connectReceiver = async (wsUrl: string, syncCode: string, pin: string) => {
    if (connectionPromiseRef.current) return connectionPromiseRef.current;
    if (!deviceId) throw new Error('Device ID not found');
    if (!pin) throw new Error('Pin is required for receiver');
    if (isConnectedRef.current && wsRef.current?.readyState === WebSocket.OPEN) return;

    connectionPromiseRef.current = (async () => {
      try {
        const { wsUrlWithCode, deviceId: currentDeviceId, signature, userDhPair } = await buildAuthFrame(wsUrl, syncCode);
        await connectToWs(wsUrlWithCode, currentDeviceId, signature, userDhPair.public);
        await calculateMutualSecret(userDhPair.private);
        await receiveKey(pin);
      } catch (e) {
        disconnect();
        throw e;
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
    error,
    isConnected: isConnectedRef.current,
    initializeKeySync,
    connectReceiver,
    disconnect,
  };
}
