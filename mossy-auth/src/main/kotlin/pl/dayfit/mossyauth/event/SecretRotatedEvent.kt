package pl.dayfit.mossyauth.event

import com.nimbusds.jose.jwk.OctetKeyPair

data class SecretRotatedEvent(
    val newSecret: OctetKeyPair
)
