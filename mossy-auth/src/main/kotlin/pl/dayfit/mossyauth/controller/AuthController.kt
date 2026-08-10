package pl.dayfit.mossyauth.controller

import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseCookie
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.CookieValue
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossyauth.configuration.properties.CookiesConfigurationProperties
import pl.dayfit.mossyauth.configuration.properties.JwtConfigurationProperties
import pl.dayfit.mossyauth.dto.request.LoginRequestDto
import pl.dayfit.mossyauth.dto.request.RegisterUserRequestDto
import pl.dayfit.mossyauth.dto.response.AuthStatusDto
import pl.dayfit.mossyauth.dto.response.GenericServerResponseDto
import pl.dayfit.mossyauth.dto.response.LoginResponseDto
import pl.dayfit.mossyauth.service.JwtManagementService
import pl.dayfit.mossyauth.service.UserService
import pl.dayfit.mossyauth.type.AccessTokenType
import java.time.Duration

@RestController
class AuthController(
    private val userService: UserService,
    private val cookiesConfigurationProperties: CookiesConfigurationProperties,
    private val jwtConfigurationProperties: JwtConfigurationProperties,
    private val jwtManagementService: JwtManagementService
) {
    companion object {
        private const val REFRESH_TOKEN_NAME = "refreshToken"
    }

    @PostMapping("/register")
    fun handleRegister(
        @RequestBody @Valid requestDto: RegisterUserRequestDto,
        @RequestHeader("User-Agent") userAgent: String,
        httpServletRequest: HttpServletRequest
    ): ResponseEntity<GenericServerResponseDto>
    {

        userService.register(
            requestDto,
            userAgent,
            httpServletRequest.remoteAddr
        )

        return ResponseEntity.ok(
            GenericServerResponseDto("User registered successfully")
        )
    }

    /**
     * Authenticates user; returns access token; sets refresh token cookie
     */
    @PostMapping("/login")
    fun handleLogin(
        @RequestBody @Valid loginDto: LoginRequestDto,
        @RequestHeader("User-Agent") userAgent: String,
        httpServletRequest: HttpServletRequest
    ): ResponseEntity<LoginResponseDto>
    {
        val tokens = userService.login(
            loginDto,
            userAgent,
            httpServletRequest.remoteAddr,
        )

        check(
            (tokens.refreshToken == null && tokens.accessTokenType == AccessTokenType.DEVICE_ENROLLMENT_TOKEN)
                    ||
            (tokens.refreshToken != null && tokens.accessTokenType == AccessTokenType.ACCESS_TOKEN)
        )

        val response = LoginResponseDto(
            tokens.accessToken,
            tokens.accessTokenType
        )

        tokens.refreshToken ?: return ResponseEntity.ok(response)

        val refreshTokenCookie = ResponseCookie.from(REFRESH_TOKEN_NAME, tokens.refreshToken)
            .path("/")
            .sameSite("Lax")
            .secure(cookiesConfigurationProperties.secure)
            .maxAge(jwtConfigurationProperties.refreshTokenExpirationTime)
            .httpOnly(true)
            .build()

        return ResponseEntity
            .ok()
            .headers {
                it.set(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString())
            }
            .body(response)
    }

    /**
     * Logs out user by revoking token and clearing cookie
     */
    @PostMapping("/logout")
    fun handleLogout(
        @CookieValue("refreshToken") refreshToken: String,
    ): ResponseEntity<GenericServerResponseDto>
    {
        val refreshTokenCookie = ResponseCookie.from(REFRESH_TOKEN_NAME, "")
            .path("/")
            .sameSite("Lax")
            .secure(cookiesConfigurationProperties.secure)
            .maxAge(Duration.ZERO)
            .httpOnly(true)
            .build()

        jwtManagementService.revokeToken(refreshToken)

        return ResponseEntity.ok().headers {
            it.set(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString())
        }.body(GenericServerResponseDto("User logged out successfully"))
    }

    @PostMapping("/refresh")
    fun handleRefresh(
        @CookieValue("refreshToken") refreshToken: String,
    ): ResponseEntity<LoginResponseDto>
    {
        val tokens = jwtManagementService.handleTokenRefreshment(refreshToken)
        jwtManagementService.revokeToken(refreshToken) //Revoke after refreshment

        val refreshTokenCookie = ResponseCookie.from(REFRESH_TOKEN_NAME, tokens.refreshToken)
            .path("/")
            .sameSite("Lax")
            .secure(cookiesConfigurationProperties.secure)
            .maxAge(jwtConfigurationProperties.refreshTokenExpirationTime)
            .httpOnly(true)
            .build()

        return ResponseEntity.ok()
            .headers {
                it.set(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString())
            }.body(
                LoginResponseDto(tokens.accessToken, tokens.accessTokenType)
            )
    }

    @GetMapping("/status")
    fun checkAuthStatus(@AuthenticationPrincipal jwt: Jwt?): ResponseEntity<AuthStatusDto>
    {
        return ResponseEntity.ok(
            AuthStatusDto(
                jwt != null
            ))
    }
}