package pl.dayfit.mossyvault.model

import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.ManyToMany
import jakarta.persistence.OneToMany
import java.time.Instant
import java.util.UUID

@Entity
class PasswordEntry (
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    var identifier: String, //Email or username
    @ManyToMany
    @Column(unique = true, nullable = false)
    var tags: MutableList<PasswordTag> = mutableListOf(),
    var encryptedBlob: ByteArray,
    var domain: String,
    var lastModified: Instant
)