package pl.dayfit.mossyvault.model

import jakarta.persistence.CascadeType
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.ManyToMany
import jakarta.persistence.OneToOne
import org.hibernate.annotations.BatchSize
import type.PasswordType
import java.time.Instant
import java.util.UUID

@Entity
class PasswordEntry (
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    var identifier: String, //Email or username
    var passwordType: PasswordType = PasswordType.PASSWORD,
    @ManyToMany
    @BatchSize(size = 10)
    var tags: MutableList<PasswordTag> = mutableListOf(),
    @OneToOne(cascade = [CascadeType.PERSIST, CascadeType.MERGE])
    var note: PasswordNote? = null,
    var encryptedBlob: ByteArray,
    var address: String,
    var lastModified: Instant
)
