package pl.dayfit.mossydevicetrust.model

import com.nimbusds.jose.jwk.OctetKeyPair
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
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
    @GeneratedValue(strategy = GenerationType.UUID)
    var deviceId: UUID? = null,
    var userId: UUID,
    var publicIdentityKey: OctetKeyPair,
    var lastOs: String,
    var lastSeen: Instant? = null,
    var blocked: Boolean = false,

    @Transient
    private var isNew: Boolean = false
): Persistable<UUID> {
    override fun getId(): UUID? {
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