package pl.dayfit.mossyauth.service

import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import pl.dayfit.mossyauth.auth.provider.CredentialsAuthenticationProvider
import pl.dayfit.mossyauth.auth.token.CredentialsCandidateToken
import pl.dayfit.mossyauth.auth.token.CredentialsToken
import pl.dayfit.mossyauth.dto.request.LoginRequestDto
import pl.dayfit.mossyauth.dto.request.RegisterUserRequestDto
import pl.dayfit.mossyauth.model.UserModel
import pl.dayfit.mossyauth.service.cache.UserCacheService
import pl.dayfit.mossyauth.type.AuthProvider
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl

@Service
class UserService(
    private val userCacheService: UserCacheService,
    private val passwordEncoder: PasswordEncoder,
    private val jwtGenerationService: JwtGenerationService,
    private val credentialsAuthenticationProvider: CredentialsAuthenticationProvider
) {
    fun register(requestDto: RegisterUserRequestDto)
    {
        //Password cannot be null, so a result of encoding is not null as well
        val encodedPassword: String = passwordEncoder.encode(requestDto.password)!!

        val user = UserModel(
            username = requestDto.username,
            email = requestDto.email,
            password = encodedPassword,
            authProvider = AuthProvider.LOCAL,
            authorities = listOf("USER"),
            enabled = true,
            blocked = false
        )

        //TODO: create a email confirmation for account registration
        userCacheService.save(user)
    }

    fun login(loginDto: LoginRequestDto): Pair<String, String>
    {
        val candidate = CredentialsCandidateToken(
            loginDto.identifier,
            loginDto.password
        )

        val authToken = credentialsAuthenticationProvider
            .authenticate(candidate) as CredentialsToken

        return jwtGenerationService.generatePairOfTokens(
            authToken.principal as UserDetailsImpl,
        )
    }
}