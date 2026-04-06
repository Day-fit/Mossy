package pl.dayfit.mossypassword.model

import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import java.time.Instant
import java.util.UUID

@Entity
data class Vault(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    val id: UUID? = null,
    val ownerId: UUID,
    var name: String,
    val secretHash: String,
    var isOnline: Boolean = false,
    var lastSeenAt: Instant? = null,
    var passwordCount: Int = 0
)
