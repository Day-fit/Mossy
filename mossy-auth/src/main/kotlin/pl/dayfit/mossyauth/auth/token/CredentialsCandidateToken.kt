package pl.dayfit.mossyauth.auth.token

import org.springframework.security.authentication.AbstractAuthenticationToken

class CredentialsCandidateToken(
    private val identifier: String,
    private val password: String
) : AbstractAuthenticationToken(listOf()) {
    override fun getCredentials(): Any {
        return password
    }

    override fun getPrincipal(): Any {
        return identifier
    }

    override fun isAuthenticated(): Boolean {
        return false
    }
}