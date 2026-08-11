package pl.dayfit.mossydevicetrust.service

import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.whenever
import pl.dayfit.mossydevicetrust.helper.KeygenHelper.generateKeyPair
import pl.dayfit.mossydevicetrust.repository.DeviceInfoRepository
import java.security.SecureRandom
import org.bouncycastle.crypto.signers.Ed25519Signer
import org.junit.jupiter.api.assertThrows
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.ValueOperations
import pl.dayfit.mossydevicetrust.model.DeviceInfo
import pl.dayfit.mossydevicetrust.model.NonceChallenge
import pl.dayfit.mossydevicetrust.type.NonceChallengeTarget
import java.util.Optional
import java.util.UUID
import kotlin.io.encoding.Base64
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@ExtendWith(MockitoExtension::class)
class NonceChallengeServiceTest {
    @Mock
    private lateinit var repo: DeviceInfoRepository

    @Mock
    private lateinit var secureRandom: SecureRandom

    @Mock
    private lateinit var redisTemplate: RedisTemplate<UUID, NonceChallenge>

    @Mock
    private lateinit var opsForValue: ValueOperations<UUID, NonceChallenge>

    @InjectMocks
    private lateinit var nonceChallengeService: NonceChallengeService

    private val realSecureRandom = SecureRandom()

    @Test
    fun `Generator returns valid and secure nonce`() {
        val deviceId = UUID.randomUUID().toString()
        val nonce = ByteArray(16)
        realSecureRandom.nextBytes(nonce)

        doAnswer {
            nonce.copyInto(it.arguments[0] as ByteArray)
            null
        }.whenever (secureRandom).nextBytes(any())

        whenever { redisTemplate.opsForValue() }
            .thenReturn(opsForValue)
        whenever { repo.existsById(UUID.fromString(deviceId)) }
            .thenReturn(true)

        val result = nonceChallengeService.generateNonce(deviceId, NonceChallengeTarget.EXISTING_DEVICE)
            .nonce

        assertDoesNotThrow {
            Base64.UrlSafe
                .withPadding(
                    Base64.PaddingOption
                        .ABSENT_OPTIONAL
                ).decode(
                    result
                )
        }

        assert(
            result == Base64.UrlSafe.withPadding(
                Base64.PaddingOption
                    .ABSENT_OPTIONAL
            ).encode(
                nonce
            )
        )
    }

    @Test
    fun `Challenge passes for valid signature`() {
        val deviceId = UUID.randomUUID()
        val userId = UUID.randomUUID()
        val challengeId = UUID.randomUUID()

        val keyPair = generateKeyPair()
        val nonce = ByteArray(16)
        realSecureRandom.nextBytes(nonce)

        val params = Ed25519PrivateKeyParameters(
            keyPair.decodedD
        )

        val signer = Ed25519Signer().apply {
            init(true, params)
            update(nonce, 0, nonce.size)
        }

        val signature = Base64.UrlSafe.withPadding(
            Base64.PaddingOption
                .ABSENT_OPTIONAL
        ).encode(
            signer.generateSignature()
        )

        whenever { repo.findById(deviceId) }
            .thenReturn(Optional.of(
                DeviceInfo(
                    deviceId = deviceId,
                    userId = userId,
                    keyPair.toPublicJWK().decodedX,
                    "IOs"
                )
            ))

        whenever { redisTemplate.opsForValue() }
            .thenReturn(opsForValue)

        whenever {
            opsForValue
                .getAndDelete(challengeId)
        }.thenReturn(
            NonceChallenge(
                nonce,
                deviceId.toString(),
                NonceChallengeTarget.EXISTING_DEVICE,
            )
        )

        val response = nonceChallengeService.isLoginChallengeValid(
            challengeId,
            signature,
            deviceId,
            userId,
        )

        assert(response.success)
        assert(!response.alertSent)
    }

    @Test
    fun `Challenge fails for invalid signature`() {
        val deviceId = UUID.randomUUID()
        val challengeId = UUID.randomUUID()
        val userId = UUID.randomUUID()

        val keyPair = generateKeyPair()
        val nonce = ByteArray(16)
        realSecureRandom.nextBytes(nonce)

        val params = Ed25519PrivateKeyParameters(
            generateKeyPair()
                .decodedD //Other key
        )

        val signer = Ed25519Signer().apply {
            init(true, params)
            update(nonce, 0, nonce.size)
        }

        val signature = Base64.UrlSafe.withPadding(
            Base64.PaddingOption
                .ABSENT_OPTIONAL
        ).encode(
            signer.generateSignature()
        )

        whenever { repo.findById(deviceId) }
            .thenReturn(Optional.of(
                DeviceInfo(
                    deviceId = deviceId,
                    userId = userId,
                    keyPair.toPublicJWK().decodedX,
                    "Windows"
                )
            ))

        whenever { redisTemplate.opsForValue() }
            .thenReturn(opsForValue)

        whenever {
            opsForValue
                .getAndDelete(challengeId)
        }.thenReturn(
            NonceChallenge(
                nonce,
                deviceId.toString(),
                NonceChallengeTarget.EXISTING_DEVICE,
            )
        )

        val response = nonceChallengeService.isLoginChallengeValid(
            challengeId,
            signature,
            deviceId,
            userId,
        )

        assert(!response.success)
        assert(!response.alertSent)
    }

    @Test
    fun `validation of challenge throws exception if device doesn't exist`() {
        val deviceId = UUID.randomUUID()
        val challengeId = UUID.randomUUID()

        //Before checking nonce etc., first step should be to check if device exists
        whenever { repo.findById(deviceId) }
            .thenReturn(Optional.empty())

        assertThrows<NoSuchElementException> { nonceChallengeService.isLoginChallengeValid(
            challengeId,
            "Signature won't be checked in this case!",
            deviceId,
            userId = UUID.randomUUID()
        )}
    }

    @Test
    fun `validation of challenge throws exception if challenge doesn't exist`() {
        val deviceId = UUID.randomUUID()
        val challengeId = UUID.randomUUID()
        val keyPair = generateKeyPair()
        val userId = UUID.randomUUID()

        //Before checking nonce etc., nonce should be retrieved
        whenever { repo.findById(deviceId) }
            .thenReturn(Optional.of(
                DeviceInfo(
                    deviceId = deviceId,
                    userId = userId,
                    keyPair.toPublicJWK().decodedX,
                    "Android"
                )
            ))

        whenever { redisTemplate.opsForValue() }
            .thenReturn(opsForValue)

        assertThrows<NoSuchElementException> { nonceChallengeService.isLoginChallengeValid(
            challengeId,
            "Signature won't be checked in this case!",
            deviceId,
            userId
        )}
    }

    @Test
    fun `Challenge can be only passed by issuer device`() {
        val issuerDeviceId = UUID.randomUUID()
        val challengeId = UUID.randomUUID()
        val userId = UUID.randomUUID()

        //Issuer should be checked before checking if signature is valid
        whenever { repo.findById(issuerDeviceId) }
            .thenReturn(
                Optional.of(
                    DeviceInfo(
                        deviceId = issuerDeviceId,
                        userId = userId,
                        generateKeyPair().toPublicJWK().decodedX,
                        "Linux"
                    )
                )
            )

        whenever { redisTemplate.opsForValue() }
            .thenReturn(opsForValue)

        whenever {
            opsForValue
                .getAndDelete(challengeId)
        }.thenReturn(
            NonceChallenge(
                "Signature won't be checked in this case!".toByteArray(),
                UUID.randomUUID().toString(),
                NonceChallengeTarget.EXISTING_DEVICE,
            )
        )

        val response = nonceChallengeService.isLoginChallengeValid(
            challengeId,
            "Signature won't be checked in this case!",
            issuerDeviceId,
            userId
        )

        assertFalse { response.success }
        assertFalse { response.alertSent }
    }

    @Test
    fun `challenge can only be passed by the same account`() {
        val issuerDeviceId = UUID.fromString("a870b215-fe3d-4162-afaa-f2c0b5cc4581")
        val challengeId = UUID.fromString("813c7fbb-59dd-4c22-b712-2448e4a7e2df")

        val userId = UUID.fromString("e7251635-f567-4e19-b1d6-0e1008c338d7")
        val otherUserId = UUID.fromString("df7a7ed4-2691-4bb9-baf7-2d404f24b14d")

        //Issuer should be checked before checking if signature is valid
        whenever { repo.findById(issuerDeviceId) }
            .thenReturn(
                Optional.of(
                    DeviceInfo(
                        deviceId = issuerDeviceId,
                        userId = otherUserId,
                        generateKeyPair().toPublicJWK().decodedX,
                        "Linux"
                    )
                )
            )

        val response = nonceChallengeService.isLoginChallengeValid(
            challengeId,
            "Signature won't be checked in this case!",
            issuerDeviceId,
            userId
        )

        assertFalse { response.success }
        assertFalse { response.alertSent }
    }

    @Test
    fun `enrollment challenge passes for a valid signature`() {
        val enrollmentId = "enrollment-id"
        val challengeId = UUID.randomUUID()
        val keyPair = generateKeyPair()
        val nonce = randomNonce()

        givenChallenge(
            challengeId,
            NonceChallenge(
                nonce,
                enrollmentId,
                NonceChallengeTarget.DEVICE_ENROLLMENT,
            )
        )

        val result = nonceChallengeService.isEnrollmentChallengeValid(
            challengeId,
            sign(nonce, keyPair.decodedD),
            enrollmentId,
            keyPair.toPublicJWK().decodedX,
        )

        assertTrue(result)
    }

    @Test
    fun `enrollment challenge fails for a signature made by another key`() {
        val enrollmentId = "enrollment-id"
        val challengeId = UUID.randomUUID()
        val enrolledKeyPair = generateKeyPair()
        val otherKeyPair = generateKeyPair()
        val nonce = randomNonce()

        givenChallenge(
            challengeId,
            NonceChallenge(
                nonce,
                enrollmentId,
                NonceChallengeTarget.DEVICE_ENROLLMENT,
            )
        )

        val result = nonceChallengeService.isEnrollmentChallengeValid(
            challengeId,
            sign(nonce, otherKeyPair.decodedD),
            enrollmentId,
            enrolledKeyPair.toPublicJWK().decodedX,
        )

        assertFalse(result)
    }

    @Test
    fun `enrollment challenge validation fails when challenge does not exist`() {
        val challengeId = UUID.randomUUID()

        whenever(redisTemplate.opsForValue()).thenReturn(opsForValue)
        whenever(opsForValue.getAndDelete(challengeId)).thenReturn(null)

        assertThrows<NoSuchElementException> {
            nonceChallengeService.isEnrollmentChallengeValid(
                challengeId,
                "signature-will-not-be-checked",
                "enrollment-id",
                generateKeyPair().toPublicJWK().decodedX,
            )
        }
    }

    @Test
    fun `enrollment challenge fails when it belongs to another enrollment`() {
        val challengeId = UUID.randomUUID()
        val keyPair = generateKeyPair()
        val nonce = randomNonce()

        givenChallenge(
            challengeId,
            NonceChallenge(
                nonce,
                "another-enrollment-id",
                NonceChallengeTarget.DEVICE_ENROLLMENT,
            )
        )

        val result = nonceChallengeService.isEnrollmentChallengeValid(
            challengeId,
            sign(nonce, keyPair.decodedD),
            "enrollment-id",
            keyPair.toPublicJWK().decodedX,
        )

        assertFalse(result)
    }

    @Test
    fun `enrollment challenge fails when challenge targets an existing device`() {
        val enrollmentId = UUID.randomUUID().toString()
        val challengeId = UUID.randomUUID()
        val keyPair = generateKeyPair()
        val nonce = randomNonce()

        givenChallenge(
            challengeId,
            NonceChallenge(
                nonce,
                enrollmentId,
                NonceChallengeTarget.EXISTING_DEVICE,
            )
        )

        val result = nonceChallengeService.isEnrollmentChallengeValid(
            challengeId,
            sign(nonce, keyPair.decodedD),
            enrollmentId,
            keyPair.toPublicJWK().decodedX,
        )

        assertFalse(result)
    }

    private fun givenChallenge(challengeId: UUID, challenge: NonceChallenge) {
        whenever(redisTemplate.opsForValue()).thenReturn(opsForValue)
        whenever(opsForValue.getAndDelete(challengeId)).thenReturn(challenge)
    }

    private fun randomNonce(): ByteArray = ByteArray(16).also(realSecureRandom::nextBytes)

    private fun sign(nonce: ByteArray, privateKey: ByteArray): String {
        val signer = Ed25519Signer().apply {
            init(true, Ed25519PrivateKeyParameters(privateKey))
            update(nonce, 0, nonce.size)
        }

        return Base64.UrlSafe.withPadding(
            Base64.PaddingOption.ABSENT_OPTIONAL
        ).encode(signer.generateSignature())
    }
}
