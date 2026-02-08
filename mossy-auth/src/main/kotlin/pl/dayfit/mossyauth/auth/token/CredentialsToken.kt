package pl.dayfit.mossyauth.auth.token

import org.springframework.security.authentication.AbstractAuthenticationToken
import org.springframework.security.core.GrantedAuthority
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl

class CredentialsToken(
    private val userDetailsImpl: UserDetailsImpl,
    grantedAuthorities: Collection<GrantedAuthority>
) : AbstractAuthenticationToken(grantedAuthorities) {


    override fun getCredentials(): Any? {
        return null
    }

    override fun getPrincipal(): Any {
        return userDetailsImpl
    }

    override fun isAuthenticated(): Boolean {
        return true
    }
}