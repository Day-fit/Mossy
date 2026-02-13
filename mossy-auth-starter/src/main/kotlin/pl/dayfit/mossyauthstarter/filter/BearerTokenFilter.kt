package pl.dayfit.mossyauthstarter.filter

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import pl.dayfit.mossyauthstarter.auth.token.JwtAuthenticationToken
import pl.dayfit.mossyauthstarter.auth.token.JwtAuthenticationTokenCandidate

@Component
class BearerTokenFilter(
    private val authenticationManager: AuthenticationManager,
) : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        val accessToken = request.getHeader("Authorization")
            ?.removePrefix("Bearer ")

        if (accessToken == null) {
            filterChain.doFilter(request, response)
            return
        }

        if (accessToken.isBlank()) {
            filterChain.doFilter(request, response)
            return
        }

        val candidate = JwtAuthenticationTokenCandidate(
            accessToken,
        )

        val authenticationToken = authenticationManager.authenticate(candidate)
                as JwtAuthenticationToken

        SecurityContextHolder.getContext().authentication = authenticationToken
        filterChain.doFilter(request, response)
    }
}