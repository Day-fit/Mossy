package pl.dayfit.mossyauth.controller

import jakarta.servlet.http.Cookie
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.security.authentication.BadCredentialsException
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import pl.dayfit.mossyauth.configuration.properties.CookiesConfigurationProperties
import pl.dayfit.mossyauth.configuration.properties.JwtConfigurationProperties
import pl.dayfit.mossyauth.dto.request.LoginRequestDto
import pl.dayfit.mossyauth.dto.request.RegisterUserRequestDto
import pl.dayfit.mossyauth.service.JwtManagementService
import pl.dayfit.mossyauth.service.UserService
import tools.jackson.databind.json.JsonMapper

@WebMvcTest(AuthController::class)
class AuthControllerTests {
    private val jsonMapper = JsonMapper()

    @Autowired
    lateinit var mockMvc: MockMvc

    @MockitoBean
    private val userService: UserService = mock()
    @MockitoBean
    private val cookiesConfigurationProperties: CookiesConfigurationProperties = mock()
    @MockitoBean
    private val jwtConfigurationProperties: JwtConfigurationProperties = mock()
    @MockitoBean
    private val jwtManagementService: JwtManagementService = mock()

    /**
     * /register tests
     */

    @Test
    fun `test register returns 200 with valid request`() {
        val dto = RegisterUserRequestDto(
            username = "validUsername",
            email = "valid@email.com",
            password = "validPassword123"
        )

        mockMvc.perform(
            post("/register")
                .contentType("application/json")
                .content(
                    jsonMapper.writeValueAsString(dto)
                )
        ).andExpect(status().isOk)
    }

    @Test
    fun `test register returns 400 with invalid username pattern`()
    {
        val dto = RegisterUserRequestDto(
            username = "I[/]V4L1D.P4T3R[\\]",
            email = "valid@email.com",
            password = "validPassword123"
        )

        mockMvc.perform(
            post("/register")
                .contentType("application/json")
                .content(
                    jsonMapper.writeValueAsString(dto)
                )
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `test register returns 400 with blank username`()
    {
        val dto = RegisterUserRequestDto(
            username = "",
            email = "valid@email.com",
            password = "validPassword123"
        )

        mockMvc.perform(
            post("/register")
                .contentType("application/json")
                .content(
                    jsonMapper.writeValueAsString(dto)
                )
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `test register returns 400 with blank email`()
    {
        val dto = RegisterUserRequestDto(
            username = "validUsername",
            email = "",
            password = "validPassword123"
        )

        mockMvc.perform(
            post("/register")
                .contentType("application/json")
                .content(
                    jsonMapper.writeValueAsString(dto)
                )
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `test register returns 400 with invalid email format`()
    {
        val dto = RegisterUserRequestDto(
            username = "validUsername",
            email = "invalidemail@format",
            password = "validPassword123"
        )

        mockMvc.perform(
            post("/register")
                .contentType("application/json")
                .content(
                    jsonMapper.writeValueAsString(dto)
                )
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `test register returns 400 with blank password`()
    {
        val dto = RegisterUserRequestDto(
            username = "validUsername",
            email = "valid@email.com",
            password = ""
        )

        mockMvc.perform(
            post("/register")
                .contentType("application/json")
                .content(
                    jsonMapper.writeValueAsString(dto)
                )
        ).andExpect(status().isBadRequest)
    }

    /**
     *  /login tests
     */

    @Test
    fun `test login using email as identifier and valid credentials returns 200`()
    {
        val dto = LoginRequestDto(
            "valid@email.com",
            "validPassword123"
        )

        val expectedAccessToken = "accessToken"
        val expectedRefreshToken = "refreshToken"

        whenever(userService.login(dto))
            .thenReturn(Pair(expectedAccessToken, expectedRefreshToken))

        mockMvc.perform(
            post("/login")
                .contentType("application/json")
                .content(
                    jsonMapper.writeValueAsString(dto)
                )
        )   .andExpect(status().isOk)
            .andExpect(jsonPath("$.accessToken").isNotEmpty)
            .andExpect(jsonPath("$.accessToken").value(expectedAccessToken))
            .andExpect(cookie().value("refreshToken", expectedRefreshToken) )
            .andExpect(cookie().maxAge("refreshToken", jwtConfigurationProperties.refreshTokenExpirationTime.seconds.toInt()))
            .andExpect(cookie().httpOnly("refreshToken", true))
    }

    @Test
    fun `test login using username as identifier and valid credentials returns 200`()
    {
        val dto = LoginRequestDto(
            "validUsername",
            "validPassword123"
        )

        val expectedAccessToken = "accessToken"
        val expectedRefreshToken = "refreshToken"

        whenever(userService.login(dto))
            .thenReturn(Pair(expectedAccessToken, expectedRefreshToken))

        mockMvc.perform(
            post("/login")
                .contentType("application/json")
                .content(
                    jsonMapper.writeValueAsString(dto)
                )
        )   .andExpect(status().isOk)
            .andExpect(jsonPath("$.accessToken").isNotEmpty)
            .andExpect(jsonPath("$.accessToken").value(expectedAccessToken))
            .andExpect(cookie().value("refreshToken", expectedRefreshToken) )
            .andExpect(cookie().maxAge("refreshToken", jwtConfigurationProperties.refreshTokenExpirationTime.seconds.toInt()))
            .andExpect(cookie().httpOnly("refreshToken", true))
            .andExpect(cookie().secure("refreshToken", cookiesConfigurationProperties.secure))
    }

    @Test
    fun `test login using blank username returns 400`()
    {
        val dto = LoginRequestDto(
            "",
            "validPassword123"
        )

        mockMvc.perform(
            post("/login")
                .contentType("application/json")
                .content(
                    jsonMapper.writeValueAsString(dto)
                )
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `test login using invalid credentials returns 401`()
    {
        val dto = LoginRequestDto(
            "validUsername",
            "invalidPassword"
        )

        whenever(userService.login(dto))
            .thenThrow(BadCredentialsException("Bad credentials"))

        mockMvc.perform(
            post("/login")
                .contentType("application/json")
                .content(
                    jsonMapper.writeValueAsString(dto)
                )
        ).andExpect(status().isUnauthorized)
    }

    @Test
    fun `test login using blank password returns 400`()
    {
        val dto = LoginRequestDto(
            "validUsername",
            ""
        )

        mockMvc.perform(
            post("/login")
                .contentType("application/json")
                .content(
                    jsonMapper.writeValueAsString(dto)
                )
        ).andExpect(status().isBadRequest)
    }

    /**
     * /logout tests
     */

    @Test
    fun `test logout when refresh token cookie is present returns 200 and clears refresh token cookie`()
    {
        val refreshTokenCookie = Cookie("refreshToken", "refreshTokenValue")

        mockMvc.perform(
            post("/logout")
                .cookie(
                    refreshTokenCookie
                )
        )   .andExpect(status().isOk)
            .andExpect( cookie().value("refreshToken", "") )
    }

    @Test
    fun `test logout when refresh token cookie is not present returns 400`()
    {
        mockMvc.perform(
            post("/logout")
        ).andExpect(status().isBadRequest)
    }

    @Test
    fun `test logout when refresh token cookie has invalid path returns 400`()
    {
        val refreshTokenCookie = Cookie("refreshToken", "refreshTokenValue")
        refreshTokenCookie.path = "/invalidPath"

        mockMvc.perform(
            post("/logout")
        ).andExpect(status().isBadRequest)
    }
}