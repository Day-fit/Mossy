package pl.dayfit.mossyauth.service

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.authentication.dao.DaoAuthenticationProvider
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import pl.dayfit.mossyauth.dto.request.LoginRequestDto
import pl.dayfit.mossyauth.dto.request.RegisterUserRequestDto
import pl.dayfit.mossyauth.dto.response.UserDetailsResponseDto
import pl.dayfit.mossyauth.exception.UserAlreadyExistsException
import pl.dayfit.mossyauth.model.UserModel
import pl.dayfit.mossyauth.repository.UserRepository
import pl.dayfit.mossyauth.service.cache.UserCacheService
import pl.dayfit.mossyauth.type.AuthProvider
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import java.util.UUID

@Service
class UserService(
    private val userCacheService: UserCacheService,
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtGenerationService: JwtGenerationService,
    private val daoAuthenticationProvider: DaoAuthenticationProvider
) {
    fun register(requestDto: RegisterUserRequestDto)
    {
        //Password cannot be null, so a result of encoding is not null as well
        val encodedPassword: String = passwordEncoder.encode(requestDto.password)!!

        val email = requestDto.email
        val username = requestDto.username

        if (userRepository.existsByUsernameAndEmail(username, email))
        {
            throw UserAlreadyExistsException("User with given username or email already exists")
        }

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
        val candidate = UsernamePasswordAuthenticationToken(
            loginDto.identifier,
            loginDto.password
        )

        val authToken = daoAuthenticationProvider
            .authenticate(candidate) as UsernamePasswordAuthenticationToken

        return jwtGenerationService.generatePairOfTokens(
            authToken.principal as UserDetailsImpl,
        )
    }

    fun deleteUser(userId: UUID) {
        userCacheService.delete(userId)
    }

    fun getDetails(id: UUID): UserDetailsResponseDto? {
        val user = userCacheService.get(id)

        return (UserDetailsResponseDto(
            id,
            user.username,
            user.email,
            user.authorities
        ))
    }
}