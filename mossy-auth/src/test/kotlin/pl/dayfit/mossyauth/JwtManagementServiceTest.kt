package pl.dayfit.mossyauth

import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import pl.dayfit.mossyauth.repository.RevokedJwtRepository
import pl.dayfit.mossyauth.service.JwtGenerationService
import pl.dayfit.mossyauth.service.JwtManagementService
import pl.dayfit.mossyauth.service.UserDetailsService
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import java.util.UUID
import kotlin.test.assertEquals

class JwtManagementServiceTest {
    private val revokedJwtRepository: RevokedJwtRepository = mock()
    private val jwtGenerationService: JwtGenerationService = mock()
    private val userDetailsService: UserDetailsService = mock()
    private val jwtDecoder: JwtDecoder = mock()
    private val service = JwtManagementService(
        revokedJwtRepository,
        jwtGenerationService,
        userDetailsService,
        jwtDecoder
    )

    @Test
    fun `refresh decodes JWT subject and generates a new pair for that user`() {
        val refreshToken = "refresh-token"
        val userId = UUID.randomUUID()
        val jwt: Jwt = mock()
        val user = UserDetailsImpl("alice", "password", userId, "alice@example.com", listOf(SimpleGrantedAuthority("USER")))
        val expectedTokens = "access-token" to "new-refresh-token"
        whenever(revokedJwtRepository.existsByToken(refreshToken)).thenReturn(false)
        whenever(jwtDecoder.decode(refreshToken)).thenReturn(jwt)
        whenever(jwt.subject).thenReturn(userId.toString())
        whenever(userDetailsService.loadUserById(userId)).thenReturn(user)
        whenever(jwtGenerationService.generatePairOfTokens(user)).thenReturn(expectedTokens)

        assertEquals(expectedTokens, service.handleTokenRefreshment(refreshToken))
        verify(jwtDecoder).decode(refreshToken)
        verify(userDetailsService).loadUserById(userId)
        verify(jwtGenerationService).generatePairOfTokens(user)
    }
}
