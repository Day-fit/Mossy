package pl.dayfit.mossyauthstarter.auth.provider

import org.springframework.security.authentication.AuthenticationProvider
import org.springframework.security.core.Authentication
import org.springframework.stereotype.Component
import pl.dayfit.mossyauthstarter.auth.token.JwtAuthenticationTokenCandidate

@Component
class JwtAuthorizationProvider : AuthenticationProvider {
    override fun authenticate(authentication: Authentication): Authentication {

    }

    override fun supports(authentication: Class<*>): Boolean {
        return authentication.javaClass
            .isAssignableFrom(
                JwtAuthenticationTokenCandidate::class.java
            )
    }
}