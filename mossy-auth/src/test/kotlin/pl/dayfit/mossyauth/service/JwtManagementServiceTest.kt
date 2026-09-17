package pl.dayfit.mossyauth.service

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.LockedException
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import pl.dayfit.mossyauth.repository.RevokedJwtRepository
import pl.dayfit.mossyauth.type.AccessTokenType
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import pl.dayfit.mossyauthstarter.type.AudienceType
import java.util.UUID
import kotlin.test.assertEquals

class JwtManagementServiceTest {
    private val revokedJwtRepository: RevokedJwtRepository = mock()
    private val jwtGenerationService: JwtGenerationService = mock()
    private val userDetailsService: UserDetailsService = mock()
    private val jwtDecoder: JwtDecoder = mock()
    private val deviceTrustIntegrationService: DeviceTrustIntegrationService = mock()
    private val userId = UUID.randomUUID()
    private val deviceId = UUID.randomUUID()
    private val user = UserDetailsImpl("alice", "password", userId, "alice@example.com", emptyList())

    private val service = JwtManagementService(
        revokedJwtRepository,
        jwtGenerationService,
        userDetailsService,
        deviceTrustIntegrationService,
        jwtDecoder,
    )

    @Test
    fun `refresh accepts auth audience without a custom type claim`() {
        whenever(jwtDecoder.decode("refresh-token")).thenReturn(token(AudienceType.MOSSY_AUTH_API))
        whenever(userDetailsService.loadUserById(userId)).thenReturn(user)
        val expected = JwtGenerationService.TokenPairDto("access", AccessTokenType.ACCESS_TOKEN, "refresh")
        whenever(jwtGenerationService.generatePairOfTokens(user, deviceId)).thenReturn(expected)

        assertEquals(expected, service.handleTokenRefreshment("refresh-token"))
        verify(deviceTrustIntegrationService).getDeviceBlockStatus(deviceId)
        verify(jwtGenerationService).generatePairOfTokens(user, deviceId)
    }

    @Test
    fun `refresh rejects a user API audience`() {
        whenever(jwtDecoder.decode("refresh-token")).thenReturn(token(AudienceType.MOSSY_USER_API))

        assertThrows<AccessDeniedException> { service.handleTokenRefreshment("refresh-token") }
        verifyNoInteractions(userDetailsService, jwtGenerationService, deviceTrustIntegrationService)
    }

    @Test
    fun `refresh rejects a missing audience`() {
        whenever(jwtDecoder.decode("refresh-token")).thenReturn(token())

        assertThrows<AccessDeniedException> { service.handleTokenRefreshment("refresh-token") }
        verifyNoInteractions(userDetailsService, jwtGenerationService, deviceTrustIntegrationService)
    }

    @Test
    fun `refresh rejects mixed access and refresh audiences`() {
        whenever(jwtDecoder.decode("refresh-token"))
            .thenReturn(token(AudienceType.MOSSY_AUTH_API, AudienceType.MOSSY_USER_API))

        assertThrows<AccessDeniedException> { service.handleTokenRefreshment("refresh-token") }
        verifyNoInteractions(userDetailsService, jwtGenerationService, deviceTrustIntegrationService)
    }

    @Test
    fun `refresh rejects a blocked device`() {
        whenever(jwtDecoder.decode("refresh-token")).thenReturn(token(AudienceType.MOSSY_AUTH_API))
        whenever(userDetailsService.loadUserById(userId)).thenReturn(user)
        whenever(deviceTrustIntegrationService.getDeviceBlockStatus(deviceId)).thenReturn(true)

        assertThrows<LockedException> { service.handleTokenRefreshment("refresh-token") }
        verifyNoInteractions(jwtGenerationService)
    }

    private fun token(vararg audiences: AudienceType): Jwt =
        Jwt.withTokenValue("refresh-token")
            .header("typ", "JWT")
            .subject(userId.toString())
            .claim("device_id", deviceId.toString())
            .apply {
                if (audiences.isNotEmpty()) audience(audiences.map(AudienceType::toString))
            }
            .build()
}
