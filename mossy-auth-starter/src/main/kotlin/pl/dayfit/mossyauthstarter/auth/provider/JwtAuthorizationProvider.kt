package pl.dayfit.mossyauthstarter.auth.provider

import org.springframework.security.authentication.AuthenticationProvider
import org.springframework.security.core.Authentication
import org.springframework.security.core.GrantedAuthority
import org.springframework.stereotype.Component
import pl.dayfit.mossyauthstarter.auth.token.JwtAuthenticationToken
import pl.dayfit.mossyauthstarter.auth.token.JwtAuthenticationTokenCandidate
import pl.dayfit.mossyauthstarter.service.JwtClaimsService

@Component
class JwtAuthorizationProvider(
    private val jwtClaimsService: JwtClaimsService
) : AuthenticationProvider {
    override fun authenticate(authentication: Authentication): Authentication {
        val jwtTokenCandidate = authentication as JwtAuthenticationTokenCandidate

        val token = jwtTokenCandidate.credentials
        val userId = jwtClaimsService.getId(token) //Validated during `getClaims()` call
        val grantedAuthorities: Collection<GrantedAuthority> = jwtClaimsService.getRoles(token)

        return JwtAuthenticationToken(
            userId,
            grantedAuthorities
        )
    }

    override fun supports(authentication: Class<*>): Boolean {
        return JwtAuthenticationTokenCandidate::class.java
            .isAssignableFrom(authentication)
    }
}