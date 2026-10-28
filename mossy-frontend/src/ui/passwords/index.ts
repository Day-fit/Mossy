import type { PasswordType } from 'mossy-api-client/password.api';

export type CiphertextPhase = 'Fetching' | 'Decrypting';
type PasswordBaseFormState = {
    identifier: string;
    address: string;
    passwordType: PasswordType;
};

export type WebsiteProtocol = 'https://' | 'http://';

export type PasswordFormState =
    | (PasswordBaseFormState & {
          passwordType: 'PASSWORD';
          protocol: WebsiteProtocol;
          password: string;
      })
    | (PasswordBaseFormState & {
          passwordType: 'SSH_KEY';
          privateKey: string;
          publicKey?: string;
      });

export type SavePasswordResult = 'saved' | 'deferred' | 'failed';

export type StatusMessage =
    | { type: 'success'; message: string }
    | { type: 'error'; message: string }
    | null;
