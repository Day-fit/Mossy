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
import pl.dayfit.mossydevicetrustshared.dto.request.NonceChallengeRequestDto
import java.security.SecureRandom
import org.bouncycastle.crypto.signers.Ed25519Signer
import org.junit.jupiter.api.assertThrows
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.ValueOperations
import pl.dayfit.mossydevicetrust.model.DeviceInfo
import pl.dayfit.mossydevicetrust.model.NonceChallenge
import java.util.Optional
import java.util.UUID
import kotlin.io.encoding.Base64
import kotlin.test.assertFalse

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
        val deviceId = UUID.randomUUID()
        val nonce = ByteArray(16)
        realSecureRandom.nextBytes(nonce)

        doAnswer {
            nonce.copyInto(it.arguments[0] as ByteArray)
            null
        }.whenever (secureRandom).nextBytes(any())

        whenever { redisTemplate.opsForValue() }
            .thenReturn(opsForValue)

        val result = nonceChallengeService.generateNonce(deviceId)
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

        val request = NonceChallengeRequestDto(
            challengeId,
            signature,
            "IOs"
        )

        whenever { repo.findById(deviceId) }
            .thenReturn(Optional.of(
                DeviceInfo(
                    id = deviceId,
                    userId = UUID.randomUUID(),
                    keyPair.toPublicJWK(),
                    "IOs"
                )
            ))

        whenever { redisTemplate.opsForValue() }
            .thenReturn(opsForValue)

        whenever {
            opsForValue
                .get(challengeId)
        }.thenReturn(
            NonceChallenge(
                nonce,
                deviceId,
            )
        )

        val response = nonceChallengeService.isChallengeValid(
            request,
            deviceId,
        )

        assert(response.success)
        assert(!response.alertSent)
    }

    @Test
    fun `Challenge fails for invalid signature`() {
        val deviceId = UUID.randomUUID()
        val challengeId = UUID.randomUUID()

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

        val request = NonceChallengeRequestDto(
            challengeId,
            signature,
            "Windows"
        )

        whenever { repo.findById(deviceId) }
            .thenReturn(Optional.of(
                DeviceInfo(
                    id = deviceId,
                    userId = UUID.randomUUID(),
                    keyPair.toPublicJWK(),
                    "Windows"
                )
            ))

        whenever { redisTemplate.opsForValue() }
            .thenReturn(opsForValue)

        whenever {
            opsForValue
                .get(challengeId)
        }.thenReturn(
            NonceChallenge(
                nonce,
                deviceId
            )
        )

        val response = nonceChallengeService.isChallengeValid(
            request,
            deviceId,
        )

        assert(!response.success)
        assert(!response.alertSent)
    }

    @Test
    fun `validation of challenge throws exception if device doesn't exist`() {
        val deviceId = UUID.randomUUID()
        val challengeId = UUID.randomUUID()

        //Before checking nonce etc., first step should be to check if device exists
        val request = NonceChallengeRequestDto(
            challengeId,
            "Signature won't be checked in this case!",
            "Linux"
        )

        whenever { repo.findById(deviceId) }
            .thenReturn(Optional.empty())

        assertThrows<NoSuchElementException> { nonceChallengeService.isChallengeValid(
            request,
            deviceId,
        )}
    }

    @Test
    fun `validation of challenge throws exception if challenge doesn't exist`() {
        val deviceId = UUID.randomUUID()
        val challengeId = UUID.randomUUID()
        val keyPair = generateKeyPair()

        //Before checking nonce etc., nonce should be retrieved
        val request = NonceChallengeRequestDto(
            challengeId,
            "Signature won't be checked in this case!",
            "Android"
        )

        whenever { repo.findById(deviceId) }
            .thenReturn(Optional.of(
                DeviceInfo(
                    id = deviceId,
                    userId = UUID.randomUUID(),
                    keyPair.toPublicJWK(),
                    "Android"
                )
            ))

        whenever { redisTemplate.opsForValue() }
            .thenReturn(opsForValue)

        assertThrows<NoSuchElementException> { nonceChallengeService.isChallengeValid(
            request,
            deviceId,
        )}
    }

    @Test
    fun `Challenge can be only passed by issuer`() {
        val issuerDeviceId = UUID.randomUUID()
        val challengeId = UUID.randomUUID()

        //Issuer should be checked before checking if signature is valid
        val requestDto = NonceChallengeRequestDto(
            challengeId,
            "Signature won't be checked in this case!",
            "Linux"
        )

        whenever { repo.findById(issuerDeviceId) }
            .thenReturn(
                Optional.of(
                    DeviceInfo(
                        id = issuerDeviceId,
                        userId = UUID.randomUUID(),
                        generateKeyPair(),
                        "Linux"
                    )
                )
            )

        whenever { redisTemplate.opsForValue() }
            .thenReturn(opsForValue)

        whenever {
            opsForValue
                .get(challengeId)
        }.thenReturn(
            NonceChallenge(
                "Signature won't be checked in this case!".toByteArray(),
                UUID.randomUUID()
            )
        )

        val response = nonceChallengeService.isChallengeValid(
            requestDto,
            issuerDeviceId,
        )

        assertFalse { response.success }
        assertFalse { response.alertSent }
    }
}