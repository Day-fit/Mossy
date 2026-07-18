package pl.dayfit.mossyauth.service

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.authentication.dao.DaoAuthenticationProvider
import org.springframework.security.core.Authentication
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import pl.dayfit.mossyauth.dto.request.LoginRequestDto
import pl.dayfit.mossyauth.dto.request.RegisterUserRequestDto
import pl.dayfit.mossyauth.dto.response.UserDetailsResponseDto
import pl.dayfit.mossyauth.exception.UserAlreadyExistsException
import pl.dayfit.mossyauth.model.UserModel
import pl.dayfit.mossyauth.repository.UserRepository
import pl.dayfit.mossyauth.service.cache.UserCacheService
import pl.dayfit.mossyauth.type.AuthProvider
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import java.util.*

@Service
class UserService(
    private val userCacheService: UserCacheService,
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtGenerationService: JwtGenerationService,
    private val daoAuthenticationProvider: DaoAuthenticationProvider,
    private val deviceIntegrationService: DeviceIntegrationService
) {
    @Transactional
    fun register(requestDto: RegisterUserRequestDto, userAgent: String, remoteAddr: String) {
        //Passwords cannot be null, so a result of encoding is not null as well
        val encodedPassword: String = passwordEncoder.encode(requestDto.password)!!

        val email = requestDto.email
        val username = requestDto.username

        if (userRepository.existsByUsernameAndEmail(username, email)) {
            throw UserAlreadyExistsException("User with given username or email already exists")
        }

        val user = UserModel(
            username = requestDto.username,
            email = requestDto.email,
            password = encodedPassword,
            authProvider = AuthProvider.LOCAL,
            authorities = listOf("USER"),
            enabled = false,
            blocked = false
        )

        //TODO: create a email confirmation for account registration
        val savedUser = userCacheService.save(user)

        deviceIntegrationService.registerDevice(
            savedUser.id!!,
            requestDto.publicIdentityKey,
            userAgent,
            remoteAddr,
        )

        savedUser.enabled = true
        userCacheService.save(savedUser)
    }

    fun login(loginDto: LoginRequestDto): Pair<String, String> {
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

    /**
     * Produces the current-user response from the validated JWT and its converted
     * Spring authorities, avoiding a cache lookup for data already carried by the token.
     */
    fun getDetails(jwt: Jwt, authentication: Authentication): UserDetailsResponseDto {
        return UserDetailsResponseDto(
            UUID.fromString(jwt.subject),
            jwt.claims["preferred_username"] as String,
            //TODO: when adding support for external oauth2 providers, please update it to handle the case when email is not present in the claims
            jwt.claims["email"] as String,
            authentication.authorities.mapNotNull {
                it.authority
            }
        )
    }
}
