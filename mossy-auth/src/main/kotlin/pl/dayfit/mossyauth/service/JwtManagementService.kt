package pl.dayfit.mossyauth.service

import org.springframework.stereotype.Service
import pl.dayfit.mossyauth.model.RevokedJwtModel
import pl.dayfit.mossyauth.repository.RevokedJwtRepository
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import pl.dayfit.mossyauthstarter.service.JwtClaimsService
import java.time.Instant

@Service
class JwtManagementService(
    private val revokedJwtRepository: RevokedJwtRepository,
    private val jwtClaimsService: JwtClaimsService,
    private val jwtGenerationService: JwtGenerationService,
    private val userDetailsService: UserDetailsService
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
        val userId = jwtClaimsService.getId(refreshToken)
        val userDetails = userDetailsService.loadUserById(userId)
        val newPair = jwtGenerationService.generatePairOfTokens(userDetails as UserDetailsImpl)

        return newPair
    }
}