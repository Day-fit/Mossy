package pl.dayfit.mossydevicetrust.model

import java.util.UUID

class NonceChallenge (
    val nonce: ByteArray,
    val issuerDeviceId: UUID
)