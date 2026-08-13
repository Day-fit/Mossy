package pl.dayfit.mossydevicetrust.service

import org.bouncycastle.crypto.signers.Ed25519Signer
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.stereotype.Service
import pl.dayfit.mossydevicetrust.exception.EnrollmentNotAcceptedYetException
import pl.dayfit.mossydevicetrust.model.NonceChallenge
import pl.dayfit.mossydevicetrust.repository.DeviceEnrollmentRequestRepository
import pl.dayfit.mossydevicetrust.repository.DeviceInfoRepository
import pl.dayfit.mossydevicetrust.type.NonceChallengeTarget
import pl.dayfit.mossydevicetrustshared.dto.response.GenerateChallengeResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.NonceChallengeResponseDto
import java.security.SecureRandom
import java.time.Duration
import java.time.Instant
import java.util.UUID
import kotlin.io.encoding.Base64

@Service
class NonceChallengeService(
    private val deviceEnrollmentRequestRepository: DeviceEnrollmentRequestRepository,
    private val deviceInfoRepository: DeviceInfoRepository,
    private val secureRandom: SecureRandom,
    private val redisTemplate: RedisTemplate<UUID, NonceChallenge>
) {
    companion object {
        val EXPIRES_IN_FOR_EXISTING_DEVICE: Duration = Duration.ofMinutes(5)
        val EXPIRES_IN_FOR_DEVICE_ENROLLMENT: Duration = Duration.ofSeconds(30)
    }

    /**
     * Creates a one-time challenge bound to either an existing device or a pending enrollment.
     *
     * [targetId] is deliberately a [String] because the two target types use different identifier
     * representations: pass an existing device's UUID in its canonical string form for
     * [NonceChallengeTarget.EXISTING_DEVICE], or pass the enrollment ID directly for
     * [NonceChallengeTarget.DEVICE_ENROLLMENT]. [targetType] records how the identifier must be
     * interpreted when the signed challenge is later validated.
     *
     * The generated 16-byte nonce and its target binding are stored in Redis under a separate,
     * random challenge ID. Existing-device challenges expire after five minutes, while enrollment
     * challenges expire after thirty seconds. The returned nonce is URL-safe Base64 without
     * padding and is accompanied by the challenge ID and its expiration timestamp.
     *
     * @param targetId identifier of the device or enrollment that is allowed to answer the challenge
     * @param targetType identifies the kind of [targetId] and selects the challenge lifetime
     * @return the encoded nonce, its expiration time, and the ID used to submit the response
     */
    fun generateNonce(targetId: String, targetType: NonceChallengeTarget): GenerateChallengeResponseDto {
        val nonce = ByteArray(16)
        secureRandom.nextBytes(nonce)

        var expiresIn: Duration?

        if (targetType == NonceChallengeTarget.EXISTING_DEVICE) {
            if(!deviceInfoRepository.existsById(UUID.fromString(targetId))) {
                if (deviceEnrollmentRequestRepository.existsById(UUID.fromString(targetId))) {
                    throw EnrollmentNotAcceptedYetException()
                }

                throw NoSuchElementException("No such device exists: $targetId")
            }

            expiresIn = EXPIRES_IN_FOR_EXISTING_DEVICE

        } else {
            expiresIn = EXPIRES_IN_FOR_DEVICE_ENROLLMENT
        }

        val challengeId = UUID.randomUUID()
        redisTemplate.opsForValue()
            .set(
                challengeId,
                NonceChallenge(
                    nonce,
                    targetId,
                    targetType,
                ),

                expiresIn,
            )

        val encodedNonce = Base64.UrlSafe.withPadding(
            Base64.PaddingOption
                .ABSENT_OPTIONAL
        ).encode(
            nonce
        )

        return GenerateChallengeResponseDto(
            encodedNonce,
            Instant.now()
                .plus(expiresIn),
            challengeId
        )
    }

    fun isEnrollmentChallengeValid(
        challengeId: UUID,
        signature: String,
        enrollmentId: String,
        publicIdentityKey: ByteArray,
    ): Boolean {
        return isChallengeValid(
            challengeId,
            signature,
            publicIdentityKey,
            enrollmentId,
            NonceChallengeTarget.DEVICE_ENROLLMENT
        )
    }

    fun isLoginChallengeValid(
        challengeId: UUID,
        signature: String,
        deviceId: UUID,
        userId: UUID,
    ): NonceChallengeResponseDto {

        val deviceInfo = deviceInfoRepository.findById(deviceId)
            .orElseThrow { NoSuchElementException("Device $deviceId doesn't exist") }

        if (deviceInfo.userId != userId || deviceInfo.blocked) {
            return NonceChallengeResponseDto(
                success = false,
                alertSent = false,
            )
        }

        val isSuccess = isChallengeValid(
            challengeId,
            signature,
            deviceInfo.publicIdentityKey,
            deviceId.toString(),
            NonceChallengeTarget.EXISTING_DEVICE,
        )

        if (isSuccess) {
            deviceInfo.lastSeen = Instant.now()
            deviceInfoRepository.save(deviceInfo)
        }

        //TODO: Implement risk engine!
        return NonceChallengeResponseDto(
            success = isSuccess,
            alertSent = false,
        )
    }

    private fun isChallengeValid(
        challengeId: UUID,
        signature: String,
        publicIdentityKey: ByteArray,
        targetId: String,
        expectedTargetType: NonceChallengeTarget
    ): Boolean {

        val params = Ed25519PublicKeyParameters(
            publicIdentityKey
        )

        val challengeNonce = redisTemplate.opsForValue()
            .getAndDelete(challengeId)

        if (challengeNonce == null) {
            throw NoSuchElementException("Challenge $challengeId for target $targetId doesn't exist")
        }

        val issuerMismatch = challengeNonce.targetId != targetId

        if (issuerMismatch || challengeNonce.target != expectedTargetType) {
            return false
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
            signature
        )

        return signer.verifySignature(decodedNonce)
    }
}
