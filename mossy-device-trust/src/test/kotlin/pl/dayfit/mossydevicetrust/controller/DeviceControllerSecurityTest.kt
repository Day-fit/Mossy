package pl.dayfit.mossydevicetrust.controller

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.RequestPostProcessor
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import pl.dayfit.mossydevicetrust.configuration.SecurityConfiguration
import pl.dayfit.mossydevicetrust.dto.response.CreateDeviceEnrollmentResponseDto
import pl.dayfit.mossyauthstarter.configuration.HttpConfiguration
import pl.dayfit.mossyauthstarter.configuration.properties.SecurityConfigurationProperties
import pl.dayfit.mossydevicetrustshared.dto.response.GenerateChallengeResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.GetIsBlockedResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.RegisterDeviceResponseDto
import java.time.Instant
import java.util.UUID
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt as securityJwt

@WebMvcTest(DeviceController::class)
@AutoConfigureMockMvc
@Import(SecurityConfiguration::class, HttpConfiguration::class)
@EnableConfigurationProperties(SecurityConfigurationProperties::class)
class DeviceControllerSecurityTest(
    @Autowired private val mockMvc: MockMvc,
) {
    @MockitoBean
    private lateinit var deviceController: DeviceController

    @MockitoBean
    private lateinit var jwtDecoder: JwtDecoder

    @Test
    fun `enrollment start scope can only call enrollment creation`() {
        whenever(deviceController.createDeviceEnrollment(any(), any(), any()))
            .thenReturn(
                ResponseEntity.ok(
                    CreateDeviceEnrollmentResponseDto(
                        enrollmentId = "enrollment-id",
                        challenge = GenerateChallengeResponseDto(
                            nonce = "nonce",
                            expiresAt = Instant.parse("2026-08-09T18:00:30Z"),
                            challengeId = UUID.randomUUID(),
                        ),
                    )
                )
            )

        mockMvc.perform(
            post("/device/enrollment")
                .with(jwtWithScope("device.enrollment.start"))
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(createEnrollmentPayload())
        ).andExpect(status().isOk)

        mockMvc.perform(
            post("/device/enrollment/challenge")
                .with(jwtWithScope("device.enrollment.start"))
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(confirmEnrollmentPayload())
        ).andExpect(status().isForbidden)

        mockMvc.perform(
            post("/device/block")
                .with(jwtWithScope("device.enrollment.start"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(blockDevicePayload())
        ).andExpect(status().isForbidden)
    }

    @Test
    fun `enrollment challenge scope can only call enrollment confirmation`() {
        whenever(deviceController.checkEnrollmentChallenge(any(), any(), any()))
            .thenReturn(ResponseEntity.ok(RegisterDeviceResponseDto(UUID.randomUUID())))

        mockMvc.perform(
            post("/device/enrollment/challenge")
                .with(jwtWithScope("device.enrollment.challenge"))
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(confirmEnrollmentPayload())
        ).andExpect(status().isOk)

        mockMvc.perform(
            post("/device/enrollment")
                .with(jwtWithScope("device.enrollment.challenge"))
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(createEnrollmentPayload())
        ).andExpect(status().isForbidden)

        mockMvc.perform(
            post("/device/block")
                .with(jwtWithScope("device.enrollment.challenge"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(blockDevicePayload())
        ).andExpect(status().isForbidden)
    }

    @Test
    fun `regular user scope cannot call enrollment endpoints`() {
        enrollmentRequests().forEach { request ->
            mockMvc.perform(request.with(jwtWithScope("user.access")))
                .andExpect(status().isForbidden)
        }
    }

    @Test
    fun `regular user scope can call non-enrollment device endpoint`() {
        val deviceId = UUID.randomUUID()
        whenever(deviceController.getIsBlocked(deviceId))
            .thenReturn(ResponseEntity.ok(GetIsBlockedResponseDto(false)))

        mockMvc.perform(
            get("/internal/device/$deviceId/block")
                .with(jwtWithScope("user.access"))
        ).andExpect(status().isOk)
    }

    @Test
    fun `nested internal device route is available to trusted services without user token`() {
        val deviceId = UUID.randomUUID()
        whenever(deviceController.getIsBlocked(deviceId))
            .thenReturn(ResponseEntity.ok(GetIsBlockedResponseDto(false)))

        mockMvc.perform(get("/internal/device/$deviceId/block"))
            .andExpect(status().isOk)
    }

    @Test
    fun `unauthenticated caller cannot call enrollment endpoints`() {
        enrollmentRequests().forEach { request ->
            mockMvc.perform(request)
                .andExpect(status().isUnauthorized)
        }
    }

    private fun enrollmentRequests() = listOf(
        post("/device/enrollment")
            .header("Idempotency-Key", UUID.randomUUID())
            .contentType(MediaType.APPLICATION_JSON)
            .content(createEnrollmentPayload()),
        post("/device/enrollment/challenge")
            .header("Idempotency-Key", UUID.randomUUID())
            .contentType(MediaType.APPLICATION_JSON)
            .content(confirmEnrollmentPayload()),
    )

    private fun jwtWithScope(scope: String): RequestPostProcessor {
        return securityJwt()
            .jwt { jwt ->
                jwt.subject(UUID.randomUUID().toString())
                    .claim("scope", scope)
            }
            .authorities(SimpleGrantedAuthority("SCOPE_$scope"))
    }

    private fun createEnrollmentPayload(): String = """
        {
            "userAgent": "Linux",
            "publicIdentityKey": {}
        }
    """.trimIndent()

    private fun confirmEnrollmentPayload(): String = """
        {
            "enrollmentId": "enrollment-id",
            "challengeId": "${UUID.randomUUID()}",
            "signature": "signed-nonce"
        }
    """.trimIndent()

    private fun blockDevicePayload(): String =
        """{"targetDeviceId":"${UUID.randomUUID()}"}"""
}
