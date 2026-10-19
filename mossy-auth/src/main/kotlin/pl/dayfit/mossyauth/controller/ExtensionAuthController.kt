package pl.dayfit.mossyauth.controller

import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseCookie
import org.springframework.http.ResponseEntity
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.security.oauth2.jwt.JwtException
import org.springframework.web.bind.annotation.CookieValue
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossyauth.configuration.ExtensionAuthOriginPolicy
import pl.dayfit.mossyauth.configuration.properties.CookiesConfigurationProperties
import pl.dayfit.mossyauth.configuration.properties.JwtConfigurationProperties
import pl.dayfit.mossyauth.dto.request.LoginRequestDto
import pl.dayfit.mossyauth.dto.response.GenericServerResponseDto
import pl.dayfit.mossyauth.dto.response.LoginResponseDto
import pl.dayfit.mossyauth.service.JwtGenerationService.TokenPairDto
import pl.dayfit.mossyauth.service.JwtManagementService
import pl.dayfit.mossyauth.service.UserService
import pl.dayfit.mossyauth.type.AccessTokenType
import java.time.Duration

@RestController
@RequestMapping("/extension")
class ExtensionAuthController(
    private val userService: UserService,
    private val cookies: CookiesConfigurationProperties,
    private val tokens: JwtConfigurationProperties,
    private val jwtManagement: JwtManagementService,
    private val origins: ExtensionAuthOriginPolicy,
) {
    @PostMapping("/login")
    fun login(
        @RequestBody @Valid credentials: LoginRequestDto,
        @RequestHeader("User-Agent") userAgent: String,
        request: HttpServletRequest,
    ): ResponseEntity<LoginResponseDto> {
        origins.requireAllowed(request.getHeader(HttpHeaders.ORIGIN))
        val pair = userService.login(credentials, userAgent, request.remoteAddr)
        check(
            (pair.accessTokenType == AccessTokenType.DEVICE_ENROLLMENT_TOKEN && pair.refreshToken == null) ||
                (pair.accessTokenType == AccessTokenType.ACCESS_TOKEN && pair.refreshToken != null)
        ) { "Unexpected extension authentication token type" }
        return tokenResponse(pair)
    }

    @PostMapping("/refresh")
    fun refresh(
        @CookieValue(name = COOKIE_NAME, required = false) refreshToken: String?,
        request: HttpServletRequest,
    ): ResponseEntity<LoginResponseDto> {
        origins.requireAllowed(request.getHeader(HttpHeaders.ORIGIN))
        if (refreshToken.isNullOrBlank()) {
            throw BadCredentialsException("Extension session is missing or expired")
        }
        val pair = try {
            jwtManagement.handleTokenRefreshment(refreshToken)
        } catch (error: JwtException) {
            throw BadCredentialsException("Extension session is invalid or expired", error)
        }
        check(pair.accessTokenType == AccessTokenType.ACCESS_TOKEN && pair.refreshToken != null) {
            "Unexpected extension refresh token type"
        }
        jwtManagement.revokeToken(refreshToken)
        return tokenResponse(pair)
    }

    @PostMapping("/logout")
    fun logout(
        @CookieValue(name = COOKIE_NAME, required = false) refreshToken: String?,
        request: HttpServletRequest,
    ): ResponseEntity<GenericServerResponseDto> {
        origins.requireAllowed(request.getHeader(HttpHeaders.ORIGIN))
        jwtManagement.revokeToken(refreshToken.orEmpty())
        return ResponseEntity.ok().headers {
            it.set(HttpHeaders.CACHE_CONTROL, "no-store")
            it.set(HttpHeaders.SET_COOKIE, refreshCookie("", Duration.ZERO).toString())
        }.body(GenericServerResponseDto("Extension signed out successfully"))
    }

    private fun tokenResponse(pair: TokenPairDto): ResponseEntity<LoginResponseDto> =
        ResponseEntity.ok().headers {
            it.set(HttpHeaders.CACHE_CONTROL, "no-store")
            pair.refreshToken?.let { refresh ->
                it.set(HttpHeaders.SET_COOKIE, refreshCookie(refresh, tokens.refreshTokenExpirationTime).toString())
            }
        }.body(LoginResponseDto(pair.accessToken, pair.accessTokenType))

    private fun refreshCookie(value: String, age: Duration): ResponseCookie =
        ResponseCookie.from(COOKIE_NAME, value)
            .path(COOKIE_PATH)
            .httpOnly(true)
            .secure(cookies.secure)
            .sameSite("Lax")
            .maxAge(age)
            .build()

    companion object {
        const val COOKIE_NAME = "mossyExtensionRefreshToken"
        const val COOKIE_PATH = "/api/v1/auth/extension"
    }
}
