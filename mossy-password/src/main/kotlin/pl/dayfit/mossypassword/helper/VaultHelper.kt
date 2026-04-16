package pl.dayfit.mossypassword.helper

import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.model.Vault
import pl.dayfit.mossypassword.repository.VaultRepository
import pl.dayfit.mossypassword.exception.VaultAccessDeniedException
import pl.dayfit.mossypassword.exception.VaultNotConnectedException
import pl.dayfit.mossypassword.exception.VaultNotFoundException
import java.util.UUID

@Component
class VaultHelper(
    private val vaultRepository: VaultRepository
) {
    /**
     * Ensures that a vault exists, is owned by the specified user, and is currently connected.
     * If the vault does not meet any of these conditions, an exception is thrown.
     *
     * @param userId The unique identifier of the user attempting to access the vault.
     * @param vaultId The unique identifier of the vault being accessed.
     * @return The vault that is owned by the user and is connected.
     * @throws VaultNotFoundException if no vault with the specified ID exists.
     * @throws VaultAccessDeniedException if the user is not the owner of the specified vault.
     * @throws VaultNotConnectedException if the specified vault is not currently connected.
     */
    fun requireOwnedConnectedVault(userId: UUID, vaultId: UUID): Vault {
        val vault = vaultRepository.findById(vaultId)
            .orElseThrow { VaultNotFoundException(vaultId) }

        if (vault.ownerId != userId) {
            throw VaultAccessDeniedException(vaultId)
        }

        if (!vault.isOnline) {
            throw VaultNotConnectedException(vaultId)
        }

        return vault
    }
}