package pl.dayfit.mossyauth

import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.whenever
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.authentication.dao.DaoAuthenticationProvider
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import pl.dayfit.mossyauth.dto.request.LoginRequestDto
import pl.dayfit.mossyauth.dto.request.RegisterUserRequestDto
import pl.dayfit.mossyauth.exception.UserAlreadyExistsException
import pl.dayfit.mossyauth.model.UserModel
import pl.dayfit.mossyauth.repository.UserRepository
import pl.dayfit.mossyauth.service.JwtGenerationService
import pl.dayfit.mossyauth.service.UserService
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
    private val daoAuthenticationProvider: DaoAuthenticationProvider = mock()
    private val userCacheService: UserCacheService = mock()
    private val jwtGenerationService: JwtGenerationService = mock()
    private val userRepository: UserRepository = mock()
    private val userService = UserService(userCacheService, userRepository, passwordEncoder, jwtGenerationService, daoAuthenticationProvider)

    @Test
    fun `test register user`() {
        val password = "test123"
        val username = "test"
        val email = "test@test.test"

        userService.register(
            RegisterUserRequestDto(username, email, password)
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
                "test123"
            )
        ) }
    }
}