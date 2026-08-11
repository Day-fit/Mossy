package pl.dayfit.mossydevicetrust.model

import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.PostLoad
import jakarta.persistence.PostPersist
import jakarta.persistence.Transient
import org.springframework.data.domain.Persistable
import java.time.Instant
import java.util.UUID

@Entity
class DeviceInfo(
    @Id
    var deviceId: UUID = UUID.randomUUID(),
    var userId: UUID,
    var publicIdentityKey: ByteArray,
    var lastUserAgent: String,
    var lastSeen: Instant? = null,
    var blocked: Boolean = false,

    @Transient
    private var isNew: Boolean = true
): Persistable<UUID> {
    override fun getId(): UUID {
        return deviceId
    }

    override fun isNew(): Boolean {
        return isNew
    }

    @PostLoad
    @PostPersist
    private fun markNotNew() {
        isNew = false
    }
}
