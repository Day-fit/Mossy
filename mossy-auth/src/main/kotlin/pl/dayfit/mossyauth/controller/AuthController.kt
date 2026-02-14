package pl.dayfit.mossyauth.controller

import jakarta.validation.Valid
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseCookie
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.CookieValue
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossyauth.configuration.properties.CookiesConfigurationProperties
import pl.dayfit.mossyauth.configuration.properties.JwtConfigurationProperties
import pl.dayfit.mossyauth.dto.request.LoginRequestDto
import pl.dayfit.mossyauth.dto.request.RegisterUserRequestDto
import pl.dayfit.mossyauth.dto.response.GenericServerResponseDto
import pl.dayfit.mossyauth.dto.response.LoginResponseDto
import pl.dayfit.mossyauth.service.JwtManagementService
import pl.dayfit.mossyauth.service.UserService
import java.time.Duration

@RestController
class AuthController(
    private val userService: UserService,
    private val cookiesConfigurationProperties: CookiesConfigurationProperties,
    private val jwtConfigurationProperties: JwtConfigurationProperties,
    private val jwtManagementService: JwtManagementService
) {
    @PostMapping("/register")
    fun handleRegister(@RequestBody @Valid requestDto: RegisterUserRequestDto): ResponseEntity<GenericServerResponseDto>
    {
        userService.register(requestDto)

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
    ): ResponseEntity<LoginResponseDto>
    {
        val tokens: Pair<String, String> = userService.login(loginDto)

        val refreshTokenCookie = ResponseCookie.from("refreshToken", tokens.second)
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
            .body(
                LoginResponseDto(tokens.first),
            )
    }

    /**
     * Logs out user by revoking token and clearing cookie
     */
    @PostMapping("/logout")
    fun handleLogout(
        @CookieValue("refreshToken") refreshToken: String,
    ): ResponseEntity<GenericServerResponseDto>
    {
        val refreshTokenCookie = ResponseCookie.from("refreshToken", "")
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
}