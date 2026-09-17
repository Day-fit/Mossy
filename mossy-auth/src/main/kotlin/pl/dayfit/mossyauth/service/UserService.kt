package pl.dayfit.mossyauth.service

import org.springframework.beans.factory.annotation.Value
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.authentication.dao.DaoAuthenticationProvider
import org.springframework.security.core.Authentication
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.support.TransactionTemplate
import pl.dayfit.mossyauth.dto.request.LoginRequestDto
import pl.dayfit.mossyauth.dto.request.RegisterUserRequestDto
import pl.dayfit.mossyauth.dto.response.RegisterUserResponseDto
import pl.dayfit.mossyauth.dto.response.UserDetailsResponseDto
import pl.dayfit.mossyauth.exception.UserAlreadyExistsException
import pl.dayfit.mossyauth.model.UserModel
import pl.dayfit.mossyauth.repository.UserRepository
import pl.dayfit.mossyauth.service.EmailVerificationService.VerificationIssuance
import pl.dayfit.mossyauth.service.cache.UserCacheService
import pl.dayfit.mossyauth.type.AccessTokenType
import pl.dayfit.mossyauth.type.AuthProvider
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import java.util.UUID

@Service
class UserService(
    private val userCacheService: UserCacheService,
    private val jwtGenerationService: JwtGenerationService,
    private val daoAuthenticationProvider: DaoAuthenticationProvider,
    private val deviceTrustIntegrationService: DeviceTrustIntegrationService,
    private val emailVerificationService: EmailVerificationService,
    private val userDetailsService: UserDetailsService,
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    @Value($$"${mossy.auth.require-email-verification:true}")
    private val requireEmailVerification: Boolean,
    transactionManager: PlatformTransactionManager
) {
    private val transactionTemplate = TransactionTemplate(transactionManager).apply {
        propagationBehavior = TransactionDefinition.PROPAGATION_REQUIRES_NEW
    }

    fun register(
        requestDto: RegisterUserRequestDto,
        userAgent: String,
        remoteAddr: String
    ): RegisterUserResponseDto {
        val result = transactionTemplate.execute {
            if (userRepository.existsByUsernameOrEmail(requestDto.username, requestDto.email)) {
                throw UserAlreadyExistsException("User with given username or email already exists")
            }

            val user = userCacheService.save(
                UserModel(
                    username = requestDto.username,
                    email = requestDto.email,
                    password = passwordEncoder.encode(requestDto.password)!!,
                    authProvider = AuthProvider.LOCAL,
                    authorities = listOf("USER"),
                    enabled = false,
                    blocked = false
                )
            )
            val deviceId = deviceTrustIntegrationService.registerDevice(
                user.id!!,
                requestDto.publicIdentityKey,
                userAgent,
                remoteAddr
            )

            user.enabled = !requireEmailVerification
            userCacheService.save(user)

            val issuance = if (requireEmailVerification) {
                emailVerificationService.issue(user)
            } else {
                null
            }

            RegistrationResult(
                RegisterUserResponseDto(deviceId, issuance?.verification),
                issuance
            )
        }

        result.issuance?.let {
            emailVerificationService.send(it.command, it.verification.verificationId)
        }
        return result.response
    }

    /**
     * Authenticates a user and returns either a device-enrollment token or a regular token pair.
     *
     * If no challenge payload is provided, the user is treated as logging in from a new device and
     * receives a device-enrollment token. If a challenge is provided, the signature is verified via
     * the device-trust service before issuing access and refresh tokens.
     *
     * @param loginDto login credentials and optional device challenge payload
     * @param userAgent caller user-agent used during challenge/device verification
     * @param remoteAddr caller remote IP address used during challenge/device verification
     * @return token wrapper containing either a device-enrollment token or a standard access/refresh pair
     * @throws BadCredentialsException when device challenge verification fails
     */
    fun login(loginDto: LoginRequestDto, userAgent: String, remoteAddr: String): JwtGenerationService.TokenPairDto {
        val candidate = UsernamePasswordAuthenticationToken(
            loginDto.identifier,
            loginDto.password
        )

        val authToken = daoAuthenticationProvider
            .authenticate(candidate) as UsernamePasswordAuthenticationToken

        val userDetails = authToken.principal as UserDetailsImpl
        userDetailsService.requireEnabled(userDetails.userId)
        val challengeDto = loginDto.challengeDto ?: return JwtGenerationService.TokenPairDto(
            jwtGenerationService.generateDeviceEnrollmentToken(
                userDetails
            ),
            AccessTokenType.DEVICE_ENROLLMENT_TOKEN
        )

        val deviceId = challengeDto.deviceId
        val deviceTrustResponse = deviceTrustIntegrationService.checkChallenge(
            userDetails.userId,
            challengeDto.challengeId,
            challengeDto.signature,
            userAgent,
            remoteAddr,
            deviceId
        )

        if (!deviceTrustResponse.success) {
            throw BadCredentialsException("Nonce challenge failed")
        }

        return jwtGenerationService.generatePairOfTokens(
            userDetails,
            deviceId
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

    private data class RegistrationResult(
        val response: RegisterUserResponseDto,
        val issuance: VerificationIssuance?
    )
}
