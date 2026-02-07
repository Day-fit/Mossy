package pl.dayfit.mossyauth.auth.token

import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.core.GrantedAuthority
import java.util.UUID

class CredentialsToken(
    private val userId: UUID,
    grantedAuthorities: Collection<GrantedAuthority>
) : AbstractAuthenticationToken(grantedAuthorities) {


    override fun getCredentials(): Any? {
        return null
    }

    override fun getPrincipal(): Any {
        return userId
    }

    override fun isAuthenticated(): Boolean {
        return true
    }
}