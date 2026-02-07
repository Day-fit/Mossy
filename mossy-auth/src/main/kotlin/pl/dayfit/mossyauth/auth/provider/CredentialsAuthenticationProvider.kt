package pl.dayfit.mossyauth.auth.provider

import org.springframework.security.authentication.AuthenticationProvider
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.security.core.Authentication
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component
import pl.dayfit.mossyauth.auth.token.CredentialsCandidateToken
import pl.dayfit.mossyauth.auth.token.CredentialsToken
import pl.dayfit.mossyauth.service.UserDetailsService
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl

@Component
class CredentialsAuthenticationProvider(
    private val userDetailsService: UserDetailsService,
    private val passwordEncoder: PasswordEncoder
) : AuthenticationProvider {
    override fun authenticate(authentication: Authentication): Authentication {
        val credentialsCandidateToken = authentication as CredentialsCandidateToken
        val password = credentialsCandidateToken.credentials as String
        val identifier = credentialsCandidateToken.principal as String

        val userDetails = userDetailsService.loadUserByUsername(identifier) as UserDetailsImpl

        if (!passwordEncoder.matches(password, userDetails.password)) {
            throw BadCredentialsException("Username or password is incorrect")
        }

        return CredentialsToken(
            userDetails.userId,
            userDetails.authorities
        )
    }

    override fun supports(authentication: Class<*>): Boolean {
        return authentication::class
            .java
            .isAssignableFrom(CredentialsCandidateToken::class.java)
    }
}