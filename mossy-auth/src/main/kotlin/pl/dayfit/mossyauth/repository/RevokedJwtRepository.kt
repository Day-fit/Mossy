package pl.dayfit.mossyauth.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import pl.dayfit.mossyauth.model.RevokedJwtModel
import java.time.Instant
import java.util.UUID

@Repository
interface RevokedJwtRepository : JpaRepository<RevokedJwtModel, UUID> {
    fun findRevokedJwtModelByValidUntilAfter(now: Instant): List<RevokedJwtModel>
}