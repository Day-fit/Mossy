package pl.dayfit.mossyauth.controller

import org.hamcrest.Matchers.containsString
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.http.MediaType
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import pl.dayfit.mossyauth.configuration.properties.CookiesConfigurationProperties
import pl.dayfit.mossyauth.configuration.properties.JwtConfigurationProperties
import pl.dayfit.mossyauth.dto.request.LoginRequestDto
import pl.dayfit.mossyauth.dto.request.RegisterUserRequestDto
import pl.dayfit.mossyauth.exception.UserAlreadyExistsException
import pl.dayfit.mossyauth.service.JwtManagementService
import pl.dayfit.mossyauth.service.UserService
import tools.jackson.module.kotlin.jsonMapper
import java.time.Duration
import java.util.UUID
import kotlin.test.Test

@WebMvcTest(AuthController::class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTest(
    @Autowired val mockMvc: MockMvc,
) {
    @MockitoBean
    private lateinit var userService: UserService

    @MockitoBean
    private lateinit var jwtManagementService: JwtManagementService

    @MockitoBean
    private lateinit var cookiesConfigurationProperties: CookiesConfigurationProperties

    @MockitoBean
    private lateinit var jwtConfigurationProperties: JwtConfigurationProperties

    private val jsonMapper = jsonMapper { }

    @Test
    fun `register returns success with correct request`() {
        val content = jsonMapper.writeValueAsString(
            RegisterUserRequestDto(
                username = "test",
                email = "test@test.com",
                password = "test123",
                publicIdentityKey = mapOf("kty" to "OKP", "crv" to "Ed25519", "x" to "public-key")
            )
        )

        mockMvc.perform(
            post("/register")
                .header("User-Agent", "Linux")
                .contentType(MediaType.APPLICATION_JSON)
                .content(content)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.message").value("User registered successfully"))
    }

    @Test
    fun `register fails validation when email is invalid`() {
        val content = jsonMapper.writeValueAsString(
            RegisterUserRequestDto(
                username = "test",
                email = "INVALID-EMAIL",
                password = "test123",
                publicIdentityKey = mapOf("kty" to "OKP")
            )
        )

        mockMvc.perform(
            post("/register")
                .header("User-Agent", "Linux")
                .contentType(MediaType.APPLICATION_JSON)
                .content(content)
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.errors[0].field").value("email"))
            .andExpect(jsonPath("$.errors[0].message").value("must be a well-formed email address"))
    }

    @Test
    fun `register returns conflict when user already exists`() {
        whenever {
            userService.register(any(), eq("Linux"), any())
        }.thenThrow(UserAlreadyExistsException("User with given username or email already exists"))

        val content = jsonMapper.writeValueAsString(
            RegisterUserRequestDto(
                username = "test",
                email = "test@test.com",
                password = "test123",
                publicIdentityKey = mapOf("kty" to "OKP")
            )
        )

        mockMvc.perform(
            post("/register")
                .header("User-Agent", "Linux")
                .contentType(MediaType.APPLICATION_JSON)
                .content(content)
        )
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.message").value("User already exists"))
    }

    @Test
    fun `login returns access token and refresh cookie with correct request`() {
        val refreshTokenExpirationTime = Duration.ofDays(14)
        whenever(cookiesConfigurationProperties.secure).thenReturn(true)
        whenever(jwtConfigurationProperties.refreshTokenExpirationTime).thenReturn(refreshTokenExpirationTime)
        whenever {
            userService.login(any(), eq("Linux"), any(), any())
        }.thenReturn("access-token" to "refresh-token")

        val content = jsonMapper.writeValueAsString(
            LoginRequestDto(
                identifier = "test",
                password = "test123",
                challengeId = UUID.fromString("b9266f2b-f473-4997-8220-60d559086c86"),
                signature = "signature"
            )
        )

        mockMvc.perform(
            post("/login")
                .header("User-Agent", "Linux")
                .header("X-Device-Id", "638fdf8c-30e5-4d43-9940-0151558af33e")
                .contentType(MediaType.APPLICATION_JSON)
                .content(content)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.accessToken").value("access-token"))
            .andExpect(cookie().value("refreshToken", "refresh-token"))
            .andExpect(header().string("Set-Cookie", containsString("HttpOnly")))
    }

    @Test
    fun `login fails when device id header is invalid`() {
        val content = jsonMapper.writeValueAsString(
            LoginRequestDto(
                identifier = "test",
                password = "test123",
                challengeId = UUID.fromString("b9266f2b-f473-4997-8220-60d559086c86"),
                signature = "signature"
            )
        )

        mockMvc.perform(
            post("/login")
                .header("User-Agent", "Linux")
                .header("X-Device-Id", "INVALID-UUID")
                .contentType(MediaType.APPLICATION_JSON)
                .content(content)
        )
            .andExpect { result -> assert(result.resolvedException is MethodArgumentTypeMismatchException) }
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value("Invalid request parameter"))
    }

    @Test
    fun `login returns unauthorized on bad credentials`() {
        whenever {
            userService.login(any(), eq("Linux"), any(), any())
        }.thenThrow(BadCredentialsException("Bad credentials"))

        val content = jsonMapper.writeValueAsString(
            LoginRequestDto(
                identifier = "test",
                password = "test123",
                challengeId = UUID.fromString("b9266f2b-f473-4997-8220-60d559086c86"),
                signature = "signature"
            )
        )

        mockMvc.perform(
            post("/login")
                .header("User-Agent", "Linux")
                .header("X-Device-Id", "638fdf8c-30e5-4d43-9940-0151558af33e")
                .contentType(MediaType.APPLICATION_JSON)
                .content(content)
        )
            .andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.message").value("Bad credentials"))
    }

    @Test
    fun `refresh fails when refresh token cookie is missing`() {
        mockMvc.perform(post("/refresh"))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value("Missing request cookie: refreshToken"))
    }
}
