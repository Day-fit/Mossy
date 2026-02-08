package pl.dayfit.mossyauth.controller

import jakarta.validation.Valid
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseCookie
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossyauth.configuration.properties.CookiesConfigurationProperties
import pl.dayfit.mossyauth.dto.request.LoginRequestDto
import pl.dayfit.mossyauth.dto.request.RegisterUserRequestDto
import pl.dayfit.mossyauth.dto.response.GenericServerResponseDto
import pl.dayfit.mossyauth.dto.response.LoginResponseDto
import pl.dayfit.mossyauth.service.UserService

@RestController
class AuthController(
    private val userService: UserService,
    private val cookiesConfigurationProperties: CookiesConfigurationProperties
) {
    @PostMapping("/register")
    fun handleRegister(@RequestBody @Valid requestDto: RegisterUserRequestDto): ResponseEntity<GenericServerResponseDto>
    {
        userService.register(requestDto)

        return ResponseEntity.ok(
            GenericServerResponseDto("User registered successfully")
        )
    }

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
}