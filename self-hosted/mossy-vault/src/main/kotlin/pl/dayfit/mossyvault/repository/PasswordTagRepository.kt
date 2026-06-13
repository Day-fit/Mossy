package pl.dayfit.mossyvault.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import pl.dayfit.mossyvault.model.PasswordTag
import java.util.UUID

@Repository
interface PasswordTagRepository : JpaRepository<PasswordTag, UUID>