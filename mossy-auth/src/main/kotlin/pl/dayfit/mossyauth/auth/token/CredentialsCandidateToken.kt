package pl.dayfit.mossyauth.auth.token

import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.core.GrantedAuthority

class CredentialsCandidateToken(
    private val identifier: String,
    private val password: String,
    grantedAuthorities: Collection<GrantedAuthority>
) : AbstractAuthenticationToken(grantedAuthorities) {


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