package pl.dayfit.mossyauth.service

import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.gen.OctetKeyPairGenerator
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
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
import org.springframework.core.ParameterizedTypeReference
import org.springframework.http.HttpEntity
import org.springframework.http.HttpMethod
import org.springframework.http.ResponseEntity
import org.springframework.http.HttpStatus
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.RestTemplate
import pl.dayfit.mossyauth.exception.DownstreamServiceUnavailableException
import pl.dayfit.mossyauth.exception.ForwardedClientErrorException
import pl.dayfit.mossydevicetrustshared.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossydevicetrustshared.dto.request.VerifyNonceChallengeRequestDto
import pl.dayfit.mossydevicetrustshared.dto.response.GetIsBlockedResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.ForwardedErrorResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.InternalResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.NonceChallengeResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.RegisterDeviceResponseDto
import java.util.UUID
import kotlin.test.assertEquals

@ExtendWith(MockitoExtension::class)
class DeviceTrustIntegrationServiceTest {
    private val restTemplate: RestTemplate = mock()
    private val jwtGenerationService: JwtGenerationService = mock()

    private val deviceTrustIntegrationService: DeviceTrustIntegrationService = DeviceTrustIntegrationService(
        restTemplate,
        VALID_TRUST_SERVICE_HOST,
        jwtGenerationService
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
        const val ACCESS_TOKEN = "internal-access-token"
    }

    @BeforeEach
    fun initializeAccessToken() {
        whenever(jwtGenerationService.generateCustomScopeAccessToken("device.trust.internal"))
            .thenReturn(ACCESS_TOKEN)
        deviceTrustIntegrationService.rotateAccessToken()
    }

    @Test
    fun `access token rotation requests internal device trust scope`() {
        verify(jwtGenerationService).generateCustomScopeAccessToken("device.trust.internal")
    }
    
    @Test
    fun `register device sends correct request and returns device id`() {
        val deviceId = UUID.fromString("6df4de64-aedf-4acc-abbf-9a39689bba7d")

        whenever (
            restTemplate.exchange(
                eq(VALID_REGISTER_DEVICE_URL),
                eq(HttpMethod.POST),
                any<HttpEntity<RegisterDeviceRequestDto>>(),
                any<ParameterizedTypeReference<RegisterDeviceResponseDto>>()
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

        val requestCaptor = argumentCaptor<HttpEntity<RegisterDeviceRequestDto>>()
        verify(restTemplate).exchange(
            eq(VALID_REGISTER_DEVICE_URL),
            eq(HttpMethod.POST),
            requestCaptor.capture(),
            any<ParameterizedTypeReference<RegisterDeviceResponseDto>>()
        )

        assertEquals(deviceId, returnedDeviceId)
        assertEquals("Bearer $ACCESS_TOKEN", requestCaptor.firstValue.headers.getFirst("Authorization"))
        val request = requireNotNull(requestCaptor.firstValue.body)
        assertEquals(validUserId, request.userId)
        assertEquals("Windows", request.userAgent)
        assertEquals("93.63.58.190", request.remoteAddr)
        assertEquals(validPublicJWK, request.publicIdentityKey)
    }

    @Test
    fun `register device throws exception on non-200 response`() {
        whenever(
            restTemplate.exchange(
                eq(VALID_REGISTER_DEVICE_URL),
                eq(HttpMethod.POST),
                any<HttpEntity<RegisterDeviceRequestDto>>(),
                any<ParameterizedTypeReference<RegisterDeviceResponseDto>>()
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
            restTemplate.exchange(
                eq(VALID_CHECK_CHALLENGE_URL),
                eq(HttpMethod.POST),
                any<HttpEntity<VerifyNonceChallengeRequestDto>>(),
                any<ParameterizedTypeReference<InternalResponseDto<NonceChallengeResponseDto>>>()
            )
        ).thenReturn(
            ResponseEntity.ok(
                InternalResponseDto(
                    result = NonceChallengeResponseDto(
                        success = true,
                        alertSent = false
                    )
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

        val requestCaptor = argumentCaptor<HttpEntity<VerifyNonceChallengeRequestDto>>()
        verify(restTemplate).exchange(
            eq(VALID_CHECK_CHALLENGE_URL),
            eq(HttpMethod.POST),
            requestCaptor.capture(),
            any<ParameterizedTypeReference<InternalResponseDto<NonceChallengeResponseDto>>>()
        )

        assertEquals(true, response.success)
        assertEquals(false, response.alertSent)
        val capturedRequest = requireNotNull(requestCaptor.firstValue.body)
        assertEquals("Bearer $ACCESS_TOKEN", requestCaptor.firstValue.headers.getFirst("Authorization"))
        assertEquals(validUserId, capturedRequest.userId)
        assertEquals(challengeId, capturedRequest.challengeId)
        assertEquals(signature, capturedRequest.signature)
        assertEquals("Linux", capturedRequest.userAgent)
        assertEquals("93.63.58.190", capturedRequest.remoteAddr)
        assertEquals(deviceId, capturedRequest.deviceId)
    }

    @Test
    fun `signature check exposes validated forwarded client error`() {
        whenever(
            restTemplate.exchange(
                eq(VALID_CHECK_CHALLENGE_URL),
                eq(HttpMethod.POST),
                any<HttpEntity<VerifyNonceChallengeRequestDto>>(),
                any<ParameterizedTypeReference<InternalResponseDto<NonceChallengeResponseDto>>>()
            )
        ).thenReturn(
            ResponseEntity.ok(
                InternalResponseDto(
                    forwardedError = ForwardedErrorResponseDto(
                        forwardedMessage = "Missing device",
                        forwardedStatusCode = HttpStatus.NOT_FOUND.value(),
                    )
                )
            )
        )

        val exception = assertThrows<ForwardedClientErrorException> {
            deviceTrustIntegrationService.checkChallenge(
                validUserId,
                UUID.randomUUID(),
                "signature",
                "Linux",
                "93.63.58.190",
                UUID.randomUUID(),
            )
        }

        assertEquals(HttpStatus.NOT_FOUND.value(), exception.forwardedError.forwardedStatusCode)
        assertTrue(exception.forwardedError.forwardedMessage.isNotBlank())
    }

    @Test
    fun `signature check rejects server status disguised as forwarded client error`() {
        whenever(
            restTemplate.exchange(
                eq(VALID_CHECK_CHALLENGE_URL),
                eq(HttpMethod.POST),
                any<HttpEntity<VerifyNonceChallengeRequestDto>>(),
                any<ParameterizedTypeReference<InternalResponseDto<NonceChallengeResponseDto>>>()
            )
        ).thenReturn(
            ResponseEntity.ok(
                InternalResponseDto(
                    forwardedError = ForwardedErrorResponseDto(
                        forwardedMessage = "Internal failure",
                        forwardedStatusCode = HttpStatus.INTERNAL_SERVER_ERROR.value(),
                    )
                )
            )
        )

        assertThrows<DownstreamServiceUnavailableException> {
            deviceTrustIntegrationService.checkChallenge(
                validUserId,
                UUID.randomUUID(),
                "signature",
                "Linux",
                "93.63.58.190",
                UUID.randomUUID(),
            )
        }
    }

    @Test
    fun `signature check throws exception on non-200 response`() {
        val challengeId = UUID.fromString("b9266f2b-f473-4997-8220-60d559086c86")
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")
        val signature = "Signature won't be checked in this case"

        whenever(
            restTemplate.exchange(
                eq(VALID_CHECK_CHALLENGE_URL),
                eq(HttpMethod.POST),
                any<HttpEntity<VerifyNonceChallengeRequestDto>>(),
                any<ParameterizedTypeReference<InternalResponseDto<NonceChallengeResponseDto>>>()
            )
        ).thenThrow(HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR))

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
            restTemplate.exchange(
                eq(VALID_CHECK_DEVICE_BLOCK_STATUS_URL),
                eq(HttpMethod.GET),
                any<HttpEntity<Unit>>(),
                any<ParameterizedTypeReference<GetIsBlockedResponseDto>>(),
                eq(deviceId)
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

        val requestCaptor = argumentCaptor<HttpEntity<Unit>>()
        verify(restTemplate).exchange(
            eq(VALID_CHECK_DEVICE_BLOCK_STATUS_URL),
            eq(HttpMethod.GET),
            requestCaptor.capture(),
            any<ParameterizedTypeReference<GetIsBlockedResponseDto>>(),
            eq(deviceId)
        )
        assertEquals("Bearer $ACCESS_TOKEN", requestCaptor.firstValue.headers.getFirst("Authorization"))
    }

    @Test
    fun `block status is false for not blocked device`() {
        val deviceId = UUID.randomUUID()

        whenever (
            restTemplate.exchange(
                eq(VALID_CHECK_DEVICE_BLOCK_STATUS_URL),
                eq(HttpMethod.GET),
                any<HttpEntity<Unit>>(),
                any<ParameterizedTypeReference<GetIsBlockedResponseDto>>(),
                eq(deviceId)
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
            restTemplate.exchange(
                eq(VALID_CHECK_DEVICE_BLOCK_STATUS_URL),
                eq(HttpMethod.GET),
                any<HttpEntity<Unit>>(),
                any<ParameterizedTypeReference<GetIsBlockedResponseDto>>(),
                eq(deviceId)
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
