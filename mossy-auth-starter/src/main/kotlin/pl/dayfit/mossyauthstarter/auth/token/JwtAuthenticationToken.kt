package pl.dayfit.mossyauthstarter.auth.token

import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.core.GrantedAuthority
import java.util.UUID

class JwtAuthenticationToken(
    private val userId: UUID,
    grantedAuthorities: Collection<GrantedAuthority>
) : AbstractAuthenticationToken(grantedAuthorities) {
    override fun getCredentials(): Any? {
        return null
    }

    override fun getPrincipal(): UUID {
        return userId
    }

    override fun isAuthenticated(): Boolean {
        return true
    }
}