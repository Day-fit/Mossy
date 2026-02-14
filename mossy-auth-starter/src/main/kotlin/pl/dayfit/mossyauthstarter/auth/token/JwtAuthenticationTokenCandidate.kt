package pl.dayfit.mossyauthstarter.auth.token

import org.springframework.security.authentication.AbstractAuthenticationToken

class JwtAuthenticationTokenCandidate(
    private val jwtToken: String,
) : AbstractAuthenticationToken(listOf()) {
    override fun getCredentials(): String {
        return jwtToken
    }

    override fun getPrincipal(): Any? {
        return null
    }
}