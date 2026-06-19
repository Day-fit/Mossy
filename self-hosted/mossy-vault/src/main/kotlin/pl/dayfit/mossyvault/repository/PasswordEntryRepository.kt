package pl.dayfit.mossyvault.repository

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import pl.dayfit.mossyvault.model.PasswordEntry
import java.util.UUID

@Repository
interface PasswordEntryRepository : JpaRepository<PasswordEntry, UUID> {
    @EntityGraph(attributePaths = ["tags"])
    fun findAllBy(): List<PasswordEntry>
    @EntityGraph(attributePaths = ["tags"])
    fun findWithTagsById(id: UUID): PasswordEntry?
}
