package pl.dayfit.mossyauthstarter.event

import java.time.Instant

data class JwksUpdatedEvent(
    val updatedAt: Instant
)
