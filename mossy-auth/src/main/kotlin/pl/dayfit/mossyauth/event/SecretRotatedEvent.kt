package pl.dayfit.mossyauth.event

import com.nimbusds.jose.jwk.RSAKey

data class SecretRotatedEvent(
    val newSecret: RSAKey,
)
