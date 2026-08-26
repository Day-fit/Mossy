package pl.dayfit.mossyauth.service

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.authentication.LockedException
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import pl.dayfit.mossyauth.repository.RevokedJwtRepository
import pl.dayfit.mossyauth.type.AccessTokenType
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals

class JwtManagementServiceTest {
    private val revokedJwtRepository: RevokedJwtRepository = mock()
    private val jwtGenerationService: JwtGenerationService = mock()
    private val userDetailsService: UserDetailsService = mock()
    private val jwtDecoder: JwtDecoder = mock()
    private val deviceTrustIntegrationService: DeviceTrustIntegrationService = mock()

    private val service = JwtManagementService(
        revokedJwtRepository,
        jwtGenerationService,
        userDetailsService,
        deviceTrustIntegrationService,
        jwtDecoder,
    )

    @Test
    fun `refresh decodes JWT subject and generates a new pair for that user`() {
        val refreshToken = "refresh-token"
        val userId = UUID.randomUUID()
        val deviceId = UUID.randomUUID()
        val jwt: Jwt = mock()
        val user = UserDetailsImpl("alice", "password", userId, "alice@example.com", listOf(SimpleGrantedAuthority("USER")))
        val expectedTokens = JwtGenerationService.TokenPairDto(
            accessToken = "access-token",
            accessTokenType = AccessTokenType.ACCESS_TOKEN,
            refreshToken = "new-refresh-token",
        )

        whenever(deviceTrustIntegrationService.getDeviceBlockStatus(deviceId)).thenReturn(false)
        whenever(revokedJwtRepository.existsByToken(refreshToken)).thenReturn(false)
        whenever(jwtDecoder.decode(refreshToken)).thenReturn(jwt)
        whenever(jwt.subject).thenReturn(userId.toString())
        whenever(jwt.claims).thenReturn(mapOf("device_id" to deviceId.toString()))
        whenever(userDetailsService.loadUserById(userId)).thenReturn(user)
        whenever(jwtGenerationService.generatePairOfTokens(user, deviceId)).thenReturn(expectedTokens)

        assertEquals(expectedTokens, service.handleTokenRefreshment(refreshToken))
        verify(jwtDecoder).decode(refreshToken)
        verify(userDetailsService).loadUserById(userId)
        verify(jwtGenerationService).generatePairOfTokens(user, deviceId)
    }

    @Test
    fun `refresh throws if device is blocked`() {
        val deviceId = UUID.randomUUID()

        val jwt = Jwt(
            "mock-token",
            Instant.now(),
            Instant.now().plusSeconds(60),
            mapOf<String, Any>("kid" to UUID.randomUUID()),
            mapOf(
                "device_id" to deviceId.toString(),
                "sub" to UUID.randomUUID().toString()
            )
        )
        whenever { jwtDecoder.decode(any() ) }
            .thenReturn(jwt)

        whenever {
            deviceTrustIntegrationService.getDeviceBlockStatus(deviceId)
        }.thenReturn(true)

        assertThrows<LockedException> {
            service.handleTokenRefreshment("mock-token")
        }
    }
}
