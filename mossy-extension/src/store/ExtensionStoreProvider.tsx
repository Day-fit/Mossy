import type { ReactNode } from "react";
import { AuthStoreProvider } from "./authStore";
import { CapturedStoreProvider } from "./capturedStore";
import { DeviceStoreProvider } from "./deviceStore";
import { EncryptionStoreProvider } from "./encryptionStore";
import { PasswordsStoreProvider } from "./passwordsStore";
import { RevealedStoreProvider } from "./revealedStore";
import { VaultStoreProvider } from "./vaultStore";

type Props = {
  children: ReactNode;
};

export default function ExtensionStoreProvider({ children }: Props) {
  return (
    <AuthStoreProvider>
      <DeviceStoreProvider>
        <EncryptionStoreProvider>
          <VaultStoreProvider>
            <CapturedStoreProvider>
              <PasswordsStoreProvider>
                <RevealedStoreProvider>{children}</RevealedStoreProvider>
              </PasswordsStoreProvider>
            </CapturedStoreProvider>
          </VaultStoreProvider>
        </EncryptionStoreProvider>
      </DeviceStoreProvider>
    </AuthStoreProvider>
  );
}
