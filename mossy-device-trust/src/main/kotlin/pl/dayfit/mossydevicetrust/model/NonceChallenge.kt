package pl.dayfit.mossydevicetrust.model

import pl.dayfit.mossydevicetrust.type.NonceChallengeTarget

class NonceChallenge (
    val nonce: ByteArray,
    val targetId: String,
    val target: NonceChallengeTarget
)