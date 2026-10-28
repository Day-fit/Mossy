import type { ReceiverDetails, UploadVaultKeyRequest } from 'mossy-api-client';
import type { NativeIdentity } from '../../storage/deviceIdentity';
import type { ReceivedVaultKey } from '../../types/models';
import type { WrappedKeyRecord } from '../../types/vault';
import type { TransferContext } from '../keySync';

export type KeyProtection =
    | { type: 'Password'; salt: Uint8Array<ArrayBuffer> }
    | { type: 'PRF'; credentialId: ArrayBuffer };

type Authorization = {
    password: string;
    prf?: Uint8Array<ArrayBuffer>;
};

export type UnlockInput = Authorization & {
    record: WrappedKeyRecord;
    extractable: boolean;
};
export type OfferInput = NativeIdentity & { deviceId: string; vaultId: string };
export type SendInput = NativeIdentity & {
    deviceId: string;
    credentialId?: ArrayBuffer;
    context: TransferContext;
};
export type ReceiveInput = ReceivedVaultKey & { context: TransferContext };
export type ProtectInput = Authorization & { protection: KeyProtection };

export interface ActionWorkerApi {
    unlock(input: UnlockInput): Promise<void>;
    read(input: { ciphertext: string }): Promise<string>;
    encrypt(input: { password: string }): Promise<string>;
    offer(input: OfferInput): Promise<ReceiverDetails>;
    send(input: SendInput): Promise<UploadVaultKeyRequest>;
    receive(input: ReceiveInput): Promise<ArrayBuffer | undefined>;
    protect(input: ProtectInput): Promise<WrappedKeyRecord>;
}
