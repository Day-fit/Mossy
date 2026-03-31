package pl.dayfit.mossypassword.helper

import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.model.Vault
import pl.dayfit.mossypassword.repository.VaultRepository
import pl.dayfit.mossypassword.service.exception.VaultAccessDeniedException
import pl.dayfit.mossypassword.service.exception.VaultNotConnectedException
import pl.dayfit.mossypassword.service.exception.VaultNotFoundException
import java.util.UUID

@Component
class VaultHelper(
    private val vaultRepository: VaultRepository
) {
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