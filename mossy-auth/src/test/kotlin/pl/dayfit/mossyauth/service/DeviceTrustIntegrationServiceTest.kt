package pl.dayfit.mossyauth.service

import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.gen.OctetKeyPairGenerator
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.ResponseEntity
import org.springframework.web.client.RestTemplate
import pl.dayfit.mossyauth.exception.DownstreamServiceUnavailableException
import pl.dayfit.mossydevicetrustshared.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossydevicetrustshared.dto.request.VerifyNonceChallengeRequestDto
import pl.dayfit.mossydevicetrustshared.dto.response.GetIsBlockedResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.NonceChallengeResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.RegisterDeviceResponseDto
import java.util.UUID
import kotlin.test.assertEquals

@ExtendWith(MockitoExtension::class)
class DeviceTrustIntegrationServiceTest {
    private val restTemplate: RestTemplate = mock()

    private val deviceTrustIntegrationService: DeviceTrustIntegrationService = DeviceTrustIntegrationService(
        restTemplate,
        VALID_TRUST_SERVICE_HOST
    )

    companion object {
        val validUserId: UUID = UUID.fromString("eba918b5-f417-4ec5-817c-151c998519ea")
        val validPublicJWK: Map<String, Any> = OctetKeyPairGenerator(Curve.Ed25519)
            .generate()
            .toPublicJWK()
            .toJSONObject()
        const val VALID_TRUST_SERVICE_HOST = "https://mossy.dayfit.pl"
        const val VALID_REGISTER_DEVICE_URL = "https://mossy.dayfit.pl/api/v1/device-trust/internal/device"
        const val VALID_CHECK_CHALLENGE_URL = "https://mossy.dayfit.pl/api/v1/device-trust/internal/nonce/challenge"
        const val VALID_CHECK_DEVICE_BLOCK_STATUS_URL = "https://mossy.dayfit.pl/api/v1/device-trust/internal/device/{deviceId}/block"
    }
    
    @Test
    fun `register device sends correct request and returns device id`() {
        val deviceId = UUID.fromString("6df4de64-aedf-4acc-abbf-9a39689bba7d")

        whenever (
            restTemplate
                .postForEntity(
                    eq(VALID_REGISTER_DEVICE_URL),
                    any<RegisterDeviceRequestDto>(),
                    eq(RegisterDeviceResponseDto::class.java)
                )
        ).thenReturn(
            ResponseEntity.ok(
            RegisterDeviceResponseDto(
                deviceId
            ))
        )

        val returnedDeviceId = deviceTrustIntegrationService.registerDevice(
            validUserId,
            validPublicJWK,
            "Windows",
            "93.63.58.190"
        )

        val requestCaptor = argumentCaptor<RegisterDeviceRequestDto>()
        verify(restTemplate).postForEntity(
            eq(VALID_REGISTER_DEVICE_URL),
            requestCaptor.capture(),
            eq(RegisterDeviceResponseDto::class.java)
        )

        assertEquals(deviceId, returnedDeviceId)
        assertEquals(validUserId, requestCaptor.firstValue.userId)
        assertEquals("Windows", requestCaptor.firstValue.osName)
        assertEquals("93.63.58.190", requestCaptor.firstValue.remoteAddr)
        assertEquals(validPublicJWK, requestCaptor.firstValue.publicIdentityKey)
    }

    @Test
    fun `register device throws exception on non-200 response`() {
        whenever(
            restTemplate.postForEntity(
                eq(VALID_REGISTER_DEVICE_URL),
                any<RegisterDeviceRequestDto>(),
                eq(RegisterDeviceResponseDto::class.java)
            )
        ).thenReturn(
            ResponseEntity.internalServerError()
                .build()
        )

        assertThrows<DownstreamServiceUnavailableException> {
            deviceTrustIntegrationService.registerDevice(
                validUserId,
                validPublicJWK,
                "Windows",
                "93.63.58.190"
            )
        }
    }

    @Test
    fun `signature check sends correct request and returns response`() {
        val challengeId = UUID.fromString("b9266f2b-f473-4997-8220-60d559086c86")
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")
        val signature = "Signature won't be checked in this case"

        whenever(
            restTemplate.postForEntity(
                eq(VALID_CHECK_CHALLENGE_URL),
                any<VerifyNonceChallengeRequestDto>(),
                eq(NonceChallengeResponseDto::class.java)
            )
        ).thenReturn(
            ResponseEntity.ok(
                NonceChallengeResponseDto(
                    success = true,
                    alertSent = false
                )
            )
        )

        val response = deviceTrustIntegrationService.checkChallenge(
            validUserId,
            challengeId,
            signature,
            "Linux",
            "93.63.58.190",
            deviceId
        )

        val requestCaptor = argumentCaptor<VerifyNonceChallengeRequestDto>()
        verify(restTemplate).postForEntity(
            eq(VALID_CHECK_CHALLENGE_URL),
            requestCaptor.capture(),
            eq(NonceChallengeResponseDto::class.java)
        )

        assertEquals(true, response.success)
        assertEquals(false, response.alertSent)
        assertEquals(validUserId, requestCaptor.firstValue.userId)
        assertEquals(challengeId, requestCaptor.firstValue.challengeId)
        assertEquals(signature, requestCaptor.firstValue.signature)
        assertEquals("Linux", requestCaptor.firstValue.os)
        assertEquals("93.63.58.190", requestCaptor.firstValue.remoteAddr)
        assertEquals(deviceId, requestCaptor.firstValue.deviceId)
    }

    @Test
    fun `signature check throws exception on non-200 response`() {
        val challengeId = UUID.fromString("b9266f2b-f473-4997-8220-60d559086c86")
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")
        val signature = "Signature won't be checked in this case"

        whenever(
            restTemplate.postForEntity(
                eq(VALID_CHECK_CHALLENGE_URL),
                any<VerifyNonceChallengeRequestDto>(),
                eq(NonceChallengeResponseDto::class.java)
            )
        ).thenReturn(
            ResponseEntity.internalServerError()
                .build()
        )

        assertThrows<DownstreamServiceUnavailableException> {
            deviceTrustIntegrationService.checkChallenge(
                validUserId,
                challengeId,
                signature,
                "Linux",
                "93.63.58.190",
                deviceId
            )
        }
    }

    @Test
    fun `block status is true for blocked device`() {
        val deviceId = UUID.randomUUID()

        whenever (
            restTemplate.getForEntity(
                VALID_CHECK_DEVICE_BLOCK_STATUS_URL,
                GetIsBlockedResponseDto::class.java,
                deviceId
            )
            ).thenReturn(
            ResponseEntity.ok(
                GetIsBlockedResponseDto(
                    isBlocked = true,
                )
            )
        )

        val result = deviceTrustIntegrationService.getDeviceBlockStatus(
            deviceId,
        )

        assertTrue(result)
    }

    @Test
    fun `block status is false for not blocked device`() {
        val deviceId = UUID.randomUUID()

        whenever (
            restTemplate.getForEntity(
                VALID_CHECK_DEVICE_BLOCK_STATUS_URL,
                GetIsBlockedResponseDto::class.java,
                deviceId
            )
        ).thenReturn(
            ResponseEntity.ok(
                GetIsBlockedResponseDto(
                    isBlocked = false,
                )
            )
        )

        val result = deviceTrustIntegrationService.getDeviceBlockStatus(
            deviceId,
        )

        assertFalse(result)
    }

    @Test
    fun `block status throws exception for non existing device`() {
        val deviceId = UUID.randomUUID()

        whenever (
            restTemplate.getForEntity(
                VALID_CHECK_DEVICE_BLOCK_STATUS_URL,
                GetIsBlockedResponseDto::class.java,
                deviceId
            )
        ).thenReturn(
            ResponseEntity.notFound()
                .build()
        )

        assertThrows<NoSuchElementException> {
            deviceTrustIntegrationService.getDeviceBlockStatus(
                deviceId,
            )
        }
    }
}
