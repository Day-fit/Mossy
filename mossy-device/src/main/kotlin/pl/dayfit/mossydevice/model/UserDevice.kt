package pl.dayfit.mossydevice.model

import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import java.time.Instant
import java.util.UUID

@Entity
data class UserDevice(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    val deviceId: UUID?,
    val userId: UUID,
    val publicKey: ByteArray,
    val approved: Boolean,
    val lastUsed: Instant?
)