package pl.dayfit.mossyauthstarter.auth.token

import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.core.GrantedAuthority
import java.util.UUID

class JwtAuthenticationTokenCandidate(
    private val jwtToken: String,
    private val userId: UUID,
    grantedAuthorities: Collection<GrantedAuthority>
) : AbstractAuthenticationToken(grantedAuthorities) {
    override fun getCredentials(): String {
        return jwtToken
    }

    override fun getPrincipal(): UUID {
        return userId
    }
}