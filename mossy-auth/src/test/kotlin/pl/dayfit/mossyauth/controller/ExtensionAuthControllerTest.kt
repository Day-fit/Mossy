package pl.dayfit.mossyauth.controller

import jakarta.servlet.http.Cookie
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.security.authentication.LockedException
import org.springframework.security.oauth2.jwt.JwtException
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.filter.CorsFilter
import pl.dayfit.mossyauth.configuration.ExtensionAuthOriginPolicy
import pl.dayfit.mossyauth.configuration.properties.CookiesConfigurationProperties
import pl.dayfit.mossyauth.configuration.properties.ExtensionAuthProperties
import pl.dayfit.mossyauth.configuration.properties.JwtConfigurationProperties
import pl.dayfit.mossyauth.controller.advice.GlobalControllerAdvice
import pl.dayfit.mossyauth.controller.advice.SecurityControllerAdvice
import pl.dayfit.mossyauth.dto.request.LoginRequestDto
import pl.dayfit.mossyauth.service.JwtGenerationService.TokenPairDto
import pl.dayfit.mossyauth.service.JwtManagementService
import pl.dayfit.mossyauth.service.UserService
import pl.dayfit.mossyauth.type.AccessTokenType
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule

class ExtensionAuthControllerTest {
    private val users: UserService = mock()
    private val jwt: JwtManagementService = mock()
    private val cookies = CookiesConfigurationProperties()
    private val tokens = JwtConfigurationProperties()
    private val credentials = LoginRequestDto("alice", "test-account-password", null)
    private lateinit var mvc: MockMvc

    @BeforeEach
    fun setup() {
        val policy = ExtensionAuthOriginPolicy(ExtensionAuthProperties().apply {
            allowedOrigins = listOf(ORIGIN)
        })
        mvc = mockMvc(policy)
    }

    private fun mockMvc(policy: ExtensionAuthOriginPolicy, cors: Boolean = false): MockMvc {
        val builder = MockMvcBuilders.standaloneSetup(
            AuthController(users, cookies, tokens, jwt),
            ExtensionAuthController(users, cookies, tokens, jwt, policy),
        ).setControllerAdvice(SecurityControllerAdvice(), GlobalControllerAdvice())
            .setMessageConverters(JacksonJsonHttpMessageConverter(
                JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()
            ))

        if (cors) {
            val webCors = CorsConfigurationSource {
                CorsConfiguration().apply {
                    allowedOrigins = listOf("https://app.mossy.test")
                    allowedMethods = listOf("POST")
                }
            }
            builder.addFilters<org.springframework.test.web.servlet.setup.StandaloneMockMvcBuilder>(
                CorsFilter(policy.corsSource(webCors))
            )
        }

        return builder.build()
    }

    @Test
    fun `extension login sets only its own scoped secure cookie while web login remains independent`() {
        whenever(users.login(eq(credentials), any(), any()))
            .thenReturn(pair("extension"), pair("web"))

        mvc.perform(login("/extension/login").header(HttpHeaders.ORIGIN, ORIGIN))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.accessToken").value("extension-access"))
            .andExpect(cookie().value(EXT_COOKIE, "extension-refresh"))
            .andExpect(cookie().path(EXT_COOKIE, "/api/v1/auth/extension"))
            .andExpect(cookie().httpOnly(EXT_COOKIE, true))
            .andExpect(cookie().secure(EXT_COOKIE, true))
            .andExpect(cookie().sameSite(EXT_COOKIE, "Lax"))
            .andExpect(cookie().doesNotExist("refreshToken"))
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))

        mvc.perform(login("/login").header(HttpHeaders.ORIGIN, "https://app.mossy.test"))
            .andExpect(status().isOk)
            .andExpect(cookie().value("refreshToken", "web-refresh"))
            .andExpect(cookie().path("refreshToken", "/"))
            .andExpect(cookie().doesNotExist(EXT_COOKIE))
    }

    @Test
    fun `unapproved device login returns enrollment token without issuing a refresh cookie`() {
        whenever(users.login(eq(credentials), any(), any()))
            .thenReturn(TokenPairDto("enrollment", AccessTokenType.DEVICE_ENROLLMENT_TOKEN))

        mvc.perform(login("/extension/login").header(HttpHeaders.ORIGIN, ORIGIN))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.accessTokenType").value("DEVICE_ENROLLMENT_TOKEN"))
            .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE))
    }

    @Test
    fun `missing untrusted malformed and web origins cannot authenticate or rotate a session`() {
        val untrustedOrigins = listOf(
            null,
            "null",
            "https://app.mossy.test",
            "chrome-extension://${"b".repeat(32)}",
            "$ORIGIN/"
        )

        for (origin in untrustedOrigins) {
            val request = login("/extension/login")

            if (origin != null) {
                request.header(HttpHeaders.ORIGIN, origin)
            }

            mvc.perform(request).andExpect(status().isForbidden)

            val refresh = post("$BASE/extension/refresh").contextPath(BASE).cookie(Cookie(EXT_COOKIE, "secret"))

            if (origin != null) {
                refresh.header(HttpHeaders.ORIGIN, origin)
            }

            mvc.perform(refresh).andExpect(status().isForbidden)

            val logout = post("$BASE/extension/logout").contextPath(BASE).cookie(Cookie(EXT_COOKIE, "secret"))

            if (origin != null) {
                logout.header(HttpHeaders.ORIGIN, origin)
            }

            mvc.perform(logout).andExpect(status().isForbidden)
        }

        verifyNoInteractions(users, jwt)
    }

    @Test
    fun `empty allowlist disables extension auth without affecting web login`() {
        mvc = mockMvc(ExtensionAuthOriginPolicy(ExtensionAuthProperties()))

        mvc.perform(login("/extension/login").header(HttpHeaders.ORIGIN, ORIGIN))
            .andExpect(status().isForbidden)

        verifyNoInteractions(users, jwt)
    }

    @Test
    fun `web cookie cannot substitute for an extension refresh cookie`() {
        mvc.perform(
            post("$BASE/extension/refresh").contextPath(BASE)
                .header(HttpHeaders.ORIGIN, ORIGIN).cookie(Cookie("refreshToken", "web-refresh"))
        )
            .andExpect(status().isUnauthorized)

        verifyNoInteractions(jwt)
    }

    @Test
    fun `concurrent web and extension sessions rotate their own refresh tokens`() {
        whenever(jwt.handleTokenRefreshment("extension-refresh")).thenReturn(pair("extension-next"))
        whenever(jwt.handleTokenRefreshment("web-refresh")).thenReturn(pair("web-next"))
        val both = arrayOf(Cookie(EXT_COOKIE, "extension-refresh"), Cookie("refreshToken", "web-refresh"))

        mvc.perform(
            post("$BASE/extension/refresh").contextPath(BASE)
                .header(HttpHeaders.ORIGIN, ORIGIN).cookie(*both)
        )
            .andExpect(status().isOk)
            .andExpect(cookie().value(EXT_COOKIE, "extension-next-refresh"))
            .andExpect(cookie().doesNotExist("refreshToken"))

        mvc.perform(post("$BASE/refresh").contextPath(BASE).cookie(*both))
            .andExpect(status().isOk)
            .andExpect(cookie().value("refreshToken", "web-next-refresh"))
            .andExpect(cookie().doesNotExist(EXT_COOKIE))

        verify(jwt).revokeToken("extension-refresh")

        verify(jwt).revokeToken("web-refresh")
    }

    @Test
    fun `invalid expired and blocked extension sessions fail without replacing cookies`() {
        whenever(jwt.handleTokenRefreshment("expired")).thenThrow(JwtException("Expired"))
        whenever(jwt.handleTokenRefreshment("blocked")).thenThrow(LockedException("Device is blocked"))

        for ((value, expected) in listOf("expired" to 401, "blocked" to 403)) {
            mvc.perform(
                post("$BASE/extension/refresh").contextPath(BASE)
                    .header(HttpHeaders.ORIGIN, ORIGIN).cookie(Cookie(EXT_COOKIE, value))
            )
                .andExpect(status().`is`(expected))
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE))

            verify(jwt, never()).revokeToken(value)
        }
    }

    @Test
    fun `extension logout revokes and clears only the extension session and tolerates a missing cookie`() {
        mvc.perform(
            post("$BASE/extension/logout").contextPath(BASE)
                .header(HttpHeaders.ORIGIN, ORIGIN)
                .cookie(Cookie(EXT_COOKIE, "extension-refresh"), Cookie("refreshToken", "web-refresh"))
        )
            .andExpect(status().isOk)
            .andExpect(cookie().maxAge(EXT_COOKIE, 0))
            .andExpect(cookie().path(EXT_COOKIE, "/api/v1/auth/extension"))
            .andExpect(cookie().doesNotExist("refreshToken"))

        verify(jwt).revokeToken("extension-refresh")

        verify(jwt, never()).revokeToken("web-refresh")

        mvc.perform(
            post("$BASE/extension/logout").contextPath(BASE).header(HttpHeaders.ORIGIN, ORIGIN)
        )
            .andExpect(status().isOk)
            .andExpect(cookie().maxAge(EXT_COOKIE, 0))
    }

    @Test
    fun `extension preflight uses only the exact extension allowlist and keeps web cors unchanged`() {
        val policy = ExtensionAuthOriginPolicy(ExtensionAuthProperties().apply { allowedOrigins = listOf(ORIGIN) })
        mvc = mockMvc(policy, cors = true)

        mvc.perform(
            options("$BASE/extension/login").contextPath(BASE)
                .header(HttpHeaders.ORIGIN, ORIGIN)
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type")
        )
            .andExpect(status().isOk)
            .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, ORIGIN))
            .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"))

        mvc.perform(
            options("$BASE/extension/login").contextPath(BASE)
                .header(HttpHeaders.ORIGIN, "https://app.mossy.test")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
        )
            .andExpect(status().isForbidden)

        mvc.perform(
            options("$BASE/login").contextPath(BASE)
                .header(HttpHeaders.ORIGIN, "https://app.mossy.test")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
        )
            .andExpect(status().isOk)
            .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "https://app.mossy.test"))
    }

    @Test
    fun `development can disable secure cookies without changing their scope`() {
        cookies.secure = false
        whenever(users.login(eq(credentials), any(), any())).thenReturn(pair("extension"))

        mvc.perform(login("/extension/login").header(HttpHeaders.ORIGIN, ORIGIN))
            .andExpect(status().isOk)
            .andExpect(cookie().secure(EXT_COOKIE, false))
            .andExpect(cookie().httpOnly(EXT_COOKIE, true))
            .andExpect(cookie().path(EXT_COOKIE, "/api/v1/auth/extension"))
    }

    private fun login(path: String) = post("$BASE$path").contextPath(BASE)
        .header(HttpHeaders.USER_AGENT, "Mossy test")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""{"identifier":"alice","password":"test-account-password","challengeDto":null}""")

    private fun pair(prefix: String) = TokenPairDto("$prefix-access", AccessTokenType.ACCESS_TOKEN, "$prefix-refresh")

    companion object {
        private const val BASE = "/api/v1/auth"
        private const val ORIGIN = "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        private const val EXT_COOKIE = ExtensionAuthController.COOKIE_NAME
    }
}
