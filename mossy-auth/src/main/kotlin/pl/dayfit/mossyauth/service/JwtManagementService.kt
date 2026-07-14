package pl.dayfit.mossyauth.service

import org.springframework.security.authentication.BadCredentialsException
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.stereotype.Service
import pl.dayfit.mossyauth.model.RevokedJwtModel
import pl.dayfit.mossyauth.repository.RevokedJwtRepository
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import java.time.Instant
import java.util.UUID

@Service
class JwtManagementService(
    private val revokedJwtRepository: RevokedJwtRepository,
    private val jwtGenerationService: JwtGenerationService,
    private val userDetailsService: UserDetailsService,
    private val jwtDecoder: JwtDecoder
) {
    fun revokeToken(jwtToken: String)
    {
        if (jwtToken.isBlank()) return

        revokedJwtRepository.save(
            RevokedJwtModel(
                token = jwtToken,
                validUntil = Instant.now()
            )
        )
    }

    /**
     * Handles the refreshment of JWT tokens by generating a new pair of access and refresh tokens
     * for the user identified by the provided refresh token.
     *
     * @param refreshToken the current refresh token used to identify and authenticate the user
     * @return a pair of strings where the first element is the new access token and the second element is the new refresh token
     */
    fun handleTokenRefreshment(refreshToken: String): Pair<String, String>
    {
        if (revokedJwtRepository.existsByToken(refreshToken))
        {
            throw BadCredentialsException("Refresh token is revoked")
        }

        val jwt = jwtDecoder.decode(refreshToken)
        val userId = UUID.fromString(jwt.subject)

        val userDetails = userDetailsService.loadUserById(userId)
        val newPair = jwtGenerationService.generatePairOfTokens(userDetails as UserDetailsImpl)

        return newPair
    }
}