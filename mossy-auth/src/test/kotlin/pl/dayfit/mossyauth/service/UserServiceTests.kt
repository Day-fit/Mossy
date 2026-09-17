package pl.dayfit.mossyauth.service

import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.lenient
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.times
import org.mockito.kotlin.whenever
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.authentication.dao.DaoAuthenticationProvider
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.SimpleTransactionStatus
import pl.dayfit.mossyauth.dto.request.LoginRequestDto
import pl.dayfit.mossyauth.dto.request.RegisterUserRequestDto
import pl.dayfit.mossyauth.exception.UserAlreadyExistsException
import pl.dayfit.mossyauth.model.UserModel
import pl.dayfit.mossyauth.repository.UserRepository
import pl.dayfit.mossyauth.service.cache.UserCacheService
import pl.dayfit.mossyauth.type.AuthProvider
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import pl.dayfit.mossydevicetrustshared.dto.response.NonceChallengeResponseDto
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertFailsWith

@ExtendWith(MockitoExtension::class)
class UserServiceTests {

    private val passwordEncoder = BCryptPasswordEncoder(7)

    @Mock
    private lateinit var daoAuthenticationProvider: DaoAuthenticationProvider
    @Mock
    private lateinit var userCacheService: UserCacheService
    @Mock
    private lateinit var jwtGenerationService: JwtGenerationService
    @Mock
    private lateinit var userRepository: UserRepository
    @Mock
    private lateinit var deviceTrustIntegrationService: DeviceTrustIntegrationService

    @Mock
    private lateinit var emailVerificationService: EmailVerificationService

    @Mock
    private lateinit var userDetailsService: UserDetailsService

    @Mock
    private lateinit var transactionManager: PlatformTransactionManager

    private lateinit var userService: UserService

    @BeforeEach
    fun setUp() {
        lenient().`when`(transactionManager.getTransaction(any()))
            .thenReturn(SimpleTransactionStatus())
        userService = UserService(
            userCacheService = userCacheService,
            jwtGenerationService = jwtGenerationService,
            daoAuthenticationProvider = daoAuthenticationProvider,
            deviceTrustIntegrationService = deviceTrustIntegrationService,
            emailVerificationService = emailVerificationService,
            userDetailsService = userDetailsService,
            userRepository = userRepository,
            passwordEncoder = passwordEncoder,
            requireEmailVerification = false,
            transactionManager = transactionManager
        )
    }

    @Test
    fun `test register user`() {
        val password = "test123"
        val username = "test"
        val email = "test@test.test"

        whenever(userCacheService.save(any<UserModel>())).thenAnswer { invocation ->
            invocation.getArgument<UserModel>(0).apply {
                id = id ?: UUID.randomUUID()
            }
        }

        whenever(deviceTrustIntegrationService.registerDevice(any(), any(), any(), any())).thenReturn(UUID.randomUUID())

        userService.register(
            RegisterUserRequestDto(username, email, password, mapOf()),
            "Windows",
            "163.84.244.143"
        )

        val captor = argumentCaptor<UserModel>()
        verify(userCacheService, times(2)).save(
            captor.capture()
        )

        val user = captor.firstValue

        assert(user.username == username)
        assert(user.email == email)
        assert(user.authProvider == AuthProvider.LOCAL)
        assert(passwordEncoder.matches(password, user.password))
        assert(!user.blocked)
        assert(user.enabled)
        assertContentEquals(listOf("USER"), user.authorities)
    }

    @Test
    fun `test logging in`()
    {
        val username = "test"
        val password = "test123"
        val challengeId = UUID.fromString("b9266f2b-f473-4997-8220-60d559086c86")
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")
        val signature = "Signature won't be checked in this case"
        val principal = UserDetailsImpl(
            username,
            passwordEncoder.encode(password),
            UUID.randomUUID(),
            null,
            listOf(SimpleGrantedAuthority("USER"))
        )

        whenever { daoAuthenticationProvider.authenticate(any()) }
            .thenReturn(
                UsernamePasswordAuthenticationToken(
                    principal, password,
                )
            )

        whenever {
            deviceTrustIntegrationService.checkChallenge(
                principal.userId,
                challengeId,
                signature,
                "Linux",
                "93.63.58.190",
                deviceId
            )
        }.thenReturn(
            NonceChallengeResponseDto(
                success = true,
                alertSent = false
            )
        )

        userService.login(
            LoginRequestDto(
                username,
                password,
                LoginRequestDto.NonceChallengeDto(deviceId, challengeId, signature),
            ),
            "Linux",
            "93.63.58.190",
        )

        verify(jwtGenerationService)
            .generatePairOfTokens(principal, deviceId)

        verify(deviceTrustIntegrationService)
            .checkChallenge(
                principal.userId,
                challengeId,
                signature,
                "Linux",
                "93.63.58.190",
                deviceId
            )
    }

    @Test
    fun `logging in fails if nonce challenge fails`()
    {
        val challengeId = UUID.fromString("b9266f2b-f473-4997-8220-60d559086c86")
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")
        val signature = "Signature won't be checked in this case"
        val username = "test"
        val password = "test123"
        val principal = UserDetailsImpl(
            username,
            passwordEncoder.encode(password),
            UUID.randomUUID(),
            null,
            listOf(SimpleGrantedAuthority("USER"))
        )

        whenever { daoAuthenticationProvider.authenticate(any()) }
            .thenReturn(
                UsernamePasswordAuthenticationToken(
                    principal, password,
                )
            )

        whenever {
            deviceTrustIntegrationService.checkChallenge(
                principal.userId,
                challengeId,
                signature,
                "Linux",
                "93.63.58.190",
                deviceId
            )
        }.thenReturn(
            NonceChallengeResponseDto(
                success = false,
                alertSent = true
            )
        )

        assertThrows<BadCredentialsException> {
            userService.login(
                LoginRequestDto(
                    username,
                    password,
                    LoginRequestDto.NonceChallengeDto(deviceId, challengeId, signature),
                ),
                "Linux",
                "93.63.58.190",
            )
        }
    }

    @Test
    fun `test deleting user`()
    {
        val userId = UUID.randomUUID()
        userService.deleteUser(userId)
        verify(userCacheService).delete(userId)
    }

    @Test
    fun `test getting details from JWT claims`() {
        val userId = UUID.randomUUID()
        val jwt: Jwt = mock()
        val authentication = UsernamePasswordAuthenticationToken(
            "principal",
            null,
            listOf(SimpleGrantedAuthority("ROLE_USER"))
        )
        whenever(jwt.subject).thenReturn(userId.toString())
        whenever(jwt.claims).thenReturn(
            mapOf(
                "preferred_username" to "test",
                "email" to "test@test.test"
            )
        )

        val details = userService.getDetails(jwt, authentication)

        assert(details.userId == userId)
        assert(details.username == "test")
        assert(details.email == "test@test.test")
        assertContentEquals(listOf("ROLE_USER"), details.grantedAuthorities)
    }

    @Test
    fun `test logging in with bad credentials`()
    {
        whenever { daoAuthenticationProvider.authenticate(any()) }
            .thenThrow(BadCredentialsException("Bad credentials") )

        assertFailsWith<BadCredentialsException> {
            userService.login(
                LoginRequestDto(
                    "test",
                    "test123",
                    null,
                ),
                "Linux",
                "93.63.58.190",
            )
        }
    }

    @Test
    fun `test registering with existing username`()
    {
        whenever { userRepository.existsByUsernameOrEmail(any(), any()) }
            .thenReturn(true)

        assertFailsWith<UserAlreadyExistsException> { userService.register(
            RegisterUserRequestDto(
                "test",
                "test@test.test",
                "test123",
                mapOf()
            ),
            "Linux",
            "163.84.244.143"
        ) }
    }

    @Test
    fun `account is not enabled until device trust service responds`() {
        val request = RegisterUserRequestDto("test", "test@test.com", "test123", mapOf())
        lateinit var savedUser: UserModel

        whenever(userCacheService.save(any<UserModel>())).thenAnswer { invocation ->
            invocation.getArgument<UserModel>(0).also {
                it.id = it.id ?: UUID.randomUUID()
                savedUser = it
            }
        }
        whenever(deviceTrustIntegrationService.registerDevice(any(), any(), any(), any())).thenAnswer {
            kotlin.test.assertFalse(savedUser.enabled)
            UUID.randomUUID()
        }

        userService.register(request, "Android", "163.84.244.143")

        kotlin.test.assertTrue(savedUser.enabled)
    }
}
