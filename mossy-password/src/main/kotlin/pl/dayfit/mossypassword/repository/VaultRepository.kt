package pl.dayfit.mossypassword.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import pl.dayfit.mossypassword.model.Vault
import java.util.Optional
import java.util.UUID

@Repository
interface VaultRepository : JpaRepository<Vault, UUID> {
    fun findAllByOwnerId(ownerId: UUID): MutableList<Vault>
    fun findByIdAndOwnerId(id: UUID, ownerId: UUID): Vault?
    fun findVaultById(id: UUID): Optional<Vault>
}
