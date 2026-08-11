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
import pl.dayfit.mossyauth.configuration.properties.CookiesConfigurationProperties
import pl.dayfit.mossyauth.configuration.properties.JwtConfigurationProperties
import pl.dayfit.mossyauth.dto.request.LoginRequestDto
import pl.dayfit.mossyauth.dto.request.RegisterUserRequestDto
import pl.dayfit.mossyauth.exception.UserAlreadyExistsException
import pl.dayfit.mossyauth.exception.ForwardedClientErrorException
import pl.dayfit.mossyauth.service.JwtManagementService
import pl.dayfit.mossyauth.service.JwtGenerationService
import pl.dayfit.mossyauth.service.UserService
import pl.dayfit.mossyauth.type.AccessTokenType
import pl.dayfit.mossydevicetrustshared.dto.response.ForwardedErrorResponseDto
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
        val deviceId = UUID.randomUUID()
        whenever { userService.register(any(), eq("Linux"), any()) }
            .thenReturn(deviceId)

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
            .andExpect(jsonPath("$.deviceId").value(deviceId.toString()))
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
            userService.login(any(), eq("Linux"), any())
        }.thenReturn(
            JwtGenerationService.TokenPairDto(
                accessToken = "access-token",
                accessTokenType = AccessTokenType.ACCESS_TOKEN,
                refreshToken = "refresh-token",
            )
        )

        val content = jsonMapper.writeValueAsString(
            LoginRequestDto(
                identifier = "test",
                password = "test123",
                challengeDto = LoginRequestDto.NonceChallengeDto(
                    deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e"),
                    challengeId = UUID.fromString("b9266f2b-f473-4997-8220-60d559086c86"),
                    signature = "signature",
                )
            )
        )

        mockMvc.perform(
            post("/login")
                .header("User-Agent", "Linux")
                .contentType(MediaType.APPLICATION_JSON)
                .content(content)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.accessToken").value("access-token"))
            .andExpect(cookie().value("refreshToken", "refresh-token"))
            .andExpect(header().string("Set-Cookie", containsString("HttpOnly")))
    }

    @Test
    fun `login fails when challenge device id is invalid`() {
        val content = """
            {
              "identifier": "test",
              "password": "test123",
              "challengeDto": {
                "deviceId": "INVALID-UUID",
                "challengeId": "b9266f2b-f473-4997-8220-60d559086c86",
                "signature": "signature"
              }
            }
        """.trimIndent()

        mockMvc.perform(
            post("/login")
                .header("User-Agent", "Linux")
                .contentType(MediaType.APPLICATION_JSON)
                .content(content)
        )
            .andExpect(status().isBadRequest)
    }

    @Test
    fun `login returns unauthorized on bad credentials`() {
        whenever {
            userService.login(any(), eq("Linux"), any())
        }.thenThrow(BadCredentialsException("Bad credentials"))

        val content = jsonMapper.writeValueAsString(
            LoginRequestDto(
                identifier = "test",
                password = "test123",
                challengeDto = LoginRequestDto.NonceChallengeDto(
                    deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e"),
                    challengeId = UUID.fromString("b9266f2b-f473-4997-8220-60d559086c86"),
                    signature = "signature",
                )
            )
        )

        mockMvc.perform(
            post("/login")
                .header("User-Agent", "Linux")
                .contentType(MediaType.APPLICATION_JSON)
                .content(content)
        )
            .andExpect(status().isUnauthorized)
    }

    @Test
    fun `login applies client status from a validated internal response`() {
        whenever {
            userService.login(any(), eq("Linux"), any())
        }.thenThrow(
            ForwardedClientErrorException(
                ForwardedErrorResponseDto(
                    forwardedMessage = "Missing device",
                    forwardedStatusCode = 404,
                )
            )
        )

        val content = jsonMapper.writeValueAsString(
            LoginRequestDto(
                identifier = "test",
                password = "test123",
                challengeDto = LoginRequestDto.NonceChallengeDto(
                    deviceId = UUID.randomUUID(),
                    challengeId = UUID.randomUUID(),
                    signature = "signature",
                )
            )
        )

        mockMvc.perform(
            post("/login")
                .header("User-Agent", "Linux")
                .contentType(MediaType.APPLICATION_JSON)
                .content(content)
        )
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.message").isNotEmpty)
    }

    @Test
    fun `refresh fails when refresh token cookie is missing`() {
        mockMvc.perform(post("/refresh"))
            .andExpect(status().isBadRequest)
    }
}
