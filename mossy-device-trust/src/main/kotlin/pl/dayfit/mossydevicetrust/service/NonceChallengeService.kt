package pl.dayfit.mossydevicetrust.service

import org.bouncycastle.crypto.signers.Ed25519Signer
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.stereotype.Service
import pl.dayfit.mossydevicetrust.model.NonceChallenge
import pl.dayfit.mossydevicetrust.repository.DeviceInfoRepository
import pl.dayfit.mossydevicetrustshared.dto.request.NonceChallengeRequestDto
import pl.dayfit.mossydevicetrustshared.dto.response.GenerateNonceResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.NonceChallengeResponseDto
import java.security.SecureRandom
import java.time.Duration
import java.time.Instant
import java.util.UUID
import kotlin.io.encoding.Base64

@Service
class NonceChallengeService(
    private val repository: DeviceInfoRepository,
    private val secureRandom: SecureRandom,
    private val redisTemplate: RedisTemplate<UUID, NonceChallenge>
) {
    companion object {
        val EXPIRES_IN: Duration = Duration.ofMinutes(5)
    }

    fun generateNonce(deviceId: UUID): GenerateNonceResponseDto {
        val nonce = ByteArray(16)
        secureRandom.nextBytes(nonce)

        val challengeId = UUID.randomUUID()
        redisTemplate.opsForValue()
            .set(
                challengeId,
                NonceChallenge(
                    nonce,
                    deviceId
                ),
                EXPIRES_IN
            )

        val encodedNonce = Base64.UrlSafe.withPadding(
            Base64.PaddingOption
                .ABSENT_OPTIONAL
        ).encode(
            nonce
        )

        return GenerateNonceResponseDto(
            encodedNonce,
            Instant.now()
                .plus(EXPIRES_IN),
            challengeId
        )
    }

    fun isChallengeValid(
        request: NonceChallengeRequestDto,
        deviceId: UUID
    ): NonceChallengeResponseDto {
        val deviceInfo = repository.findById(deviceId)
            .orElseThrow { NoSuchElementException("Device $deviceId doesn't exist") }

        val params = Ed25519PublicKeyParameters(
            deviceInfo.publicIdentityKey.decodedX
        )

        val challengeId = request.challengeId
        val challengeNonce = redisTemplate.opsForValue()
            .get(challengeId)

        if (challengeNonce == null) {
            throw NoSuchElementException("Challenge $challengeId for device $deviceId doesn't exist")
        }

        if (challengeNonce.issuerDeviceId != deviceId) {
            return NonceChallengeResponseDto(
                success = false,
                alertSent = false,
            )
        }

        val expectedNonce = challengeNonce.nonce

        val signer = Ed25519Signer().apply {
            init(false, params)
            update(expectedNonce, 0, expectedNonce.size)
        }

        val decodedNonce = Base64.UrlSafe.withPadding(
            Base64.PaddingOption
                .ABSENT_OPTIONAL
        ).decode(
            request.signature
        )

        //TODO: Implement risk engine!
        return NonceChallengeResponseDto(
            success = signer.verifySignature(decodedNonce),
            alertSent = false,
        )
    }
}