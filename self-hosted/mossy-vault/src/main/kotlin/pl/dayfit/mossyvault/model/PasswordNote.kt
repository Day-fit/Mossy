package pl.dayfit.mossyvault.model

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Lob
import java.util.UUID

@Entity
class PasswordNote (
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Lob
    @Column(nullable = false)
    var content: ByteArray = ByteArray(0)
)