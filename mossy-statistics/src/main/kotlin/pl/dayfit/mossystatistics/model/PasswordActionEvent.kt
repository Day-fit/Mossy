package pl.dayfit.mossystatistics.model

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import pl.dayfit.mossystatistics.type.ActionType
import java.time.Instant
import java.util.UUID

@Entity
data class PasswordActionEvent(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    val id: UUID? = null,
    val vaultId: UUID,
    @Column(unique = true)
    val actionId: UUID,
    val passwordId: UUID,
    val domain: String,
    @Enumerated(EnumType.STRING)
    val actionType: ActionType,
    val eventTimestamp: Instant = Instant.now()
)
