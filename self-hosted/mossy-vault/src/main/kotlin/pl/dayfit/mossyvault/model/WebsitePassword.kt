package pl.dayfit.mossyvault.model

import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import java.time.Instant
import java.util.UUID

@Entity
data class WebsitePassword (
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID?,
    var identifier: String, //Email or username
    var passwordHash: String,
    var domain: String,
    var lastModified: Instant
)