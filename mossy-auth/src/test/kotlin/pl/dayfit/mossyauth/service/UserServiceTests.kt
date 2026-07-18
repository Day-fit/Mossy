package pl.dayfit.mossyauth.service

import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
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
import pl.dayfit.mossyauth.dto.request.LoginRequestDto
import pl.dayfit.mossyauth.dto.request.RegisterUserRequestDto
import pl.dayfit.mossyauth.exception.UserAlreadyExistsException
import pl.dayfit.mossyauth.model.UserModel
import pl.dayfit.mossyauth.repository.UserRepository
import pl.dayfit.mossyauth.service.cache.UserCacheService
import pl.dayfit.mossyauth.type.AuthProvider
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
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
    private lateinit var deviceIntegrationService: DeviceIntegrationService

    private lateinit var userService: UserService

    @BeforeEach
    fun setUp() {
        userService = UserService(
            passwordEncoder = passwordEncoder,
            daoAuthenticationProvider = daoAuthenticationProvider,
            userCacheService = userCacheService,
            jwtGenerationService = jwtGenerationService,
            userRepository = userRepository,
            deviceIntegrationService = deviceIntegrationService
        )
    }

    @Test
    fun `test register user`() {
        val password = "test123"
        val username = "test"
        val email = "test@test.test"

        userService.register(
            RegisterUserRequestDto(username, email, password, mapOf()),
            "Windows",
            "163.84.244.143"
        )

        val captor = argumentCaptor<UserModel>()
        verify(userCacheService).save(
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

        userService.login(
            LoginRequestDto(username, password)
        )

        verify(jwtGenerationService)
            .generatePairOfTokens(principal)
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

        assertFailsWith<BadCredentialsException> { userService.login(LoginRequestDto("test", "test123")) }
    }

    @Test
    fun `test registering with existing username`()
    {
        whenever { userRepository.existsByUsernameAndEmail(any(), any()) }
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
        val request = RegisterUserRequestDto(
            "test",
            "test@test.com",
            "test123",
            mapOf()
        )

        val userId = UUID.randomUUID()
        val userModel = UserModel(
            userId,
            "test",
            "test",
            "test123",
            AuthProvider.LOCAL,
            listOf("USER"),
            enabled = false,
            blocked = false
        )

        val captor = argumentCaptor<UserModel>()

        whenever {
            userRepository.existsByUsernameAndEmail(any(), any())
        }.thenReturn(false)

        whenever {
            userCacheService.save(any())
        }.thenReturn(userModel)

        userService.register(
            request,
            "Android",
            "163.84.244.143"
        )

        verify(deviceIntegrationService)
            .registerDevice(
                any(),
                any(),
                any(),
                any()
            )

        verify(
            userCacheService, times(2)
        ).save(captor.capture())

        assert(!captor.firstValue.enabled)
        assert(captor.secondValue.enabled)
    }
}
