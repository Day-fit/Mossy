package pl.dayfit.mossyauth.controller

import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossyauth.dto.request.RegisterUserRequestDto
import pl.dayfit.mossyauth.dto.response.GenericServerResponseDto
import pl.dayfit.mossyauth.dto.response.LoginResponseDto
import pl.dayfit.mossyauth.service.UserService

@RestController
@RequestMapping("/api/v1/auth")
class AuthController(
    private val userService: UserService
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
    fun handleLogin(): ResponseEntity<LoginResponseDto>
    {


        return ResponseEntity.ok(
            LoginResponseDto("Dummy!")
        )
    }
}