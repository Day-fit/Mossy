package pl.dayfit.mossyauth.configuration

import jakarta.servlet.Filter
import jakarta.servlet.http.Cookie
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import org.springframework.http.HttpHeaders
import org.springframework.mock.web.MockServletContext
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.DefaultMockMvcBuilder
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.servlet.config.annotation.EnableWebMvc
import pl.dayfit.mossyauth.configuration.properties.CookiesConfigurationProperties
import pl.dayfit.mossyauth.configuration.properties.ExtensionAuthProperties
import pl.dayfit.mossyauth.configuration.properties.JwtConfigurationProperties
import pl.dayfit.mossyauth.controller.ExtensionAuthController
import pl.dayfit.mossyauth.controller.advice.GlobalControllerAdvice
import pl.dayfit.mossyauth.controller.advice.SecurityControllerAdvice
import pl.dayfit.mossyauth.service.JwtGenerationService.TokenPairDto
import pl.dayfit.mossyauth.service.JwtManagementService
import pl.dayfit.mossyauth.service.UserService
import pl.dayfit.mossyauth.type.AccessTokenType
import pl.dayfit.mossyauthstarter.configuration.properties.SecurityConfigurationProperties
import java.util.Properties

/** Exercise the actual security chain, rather than bypassing it with standalone MVC. */
class ExtensionAuthSecurityTest {
    private lateinit var context: AnnotationConfigWebApplicationContext
    private lateinit var mvc: MockMvc
    private lateinit var jwt: JwtManagementService

    @BeforeEach
    fun setup() {
        context = AnnotationConfigWebApplicationContext().apply {
            servletContext = MockServletContext()
            register(TestConfiguration::class.java)
            refresh()
        }
        jwt = context.getBean(JwtManagementService::class.java)
        mvc = MockMvcBuilders.webAppContextSetup(context)
            .addFilters<DefaultMockMvcBuilder>(context.getBean("springSecurityFilterChain", Filter::class.java))
            .build()
    }

    @AfterEach
    fun close() { context.close() }

    @Test
    fun `approved extension can refresh without a bearer header through the real chain`() {
        whenever(jwt.handleTokenRefreshment("extension-refresh"))
            .thenReturn(TokenPairDto("next-access", AccessTokenType.ACCESS_TOKEN, "next-refresh"))
        mvc.perform(post("$BASE/extension/refresh").contextPath(BASE)
            .header(HttpHeaders.ORIGIN, ORIGIN)
            .cookie(Cookie(ExtensionAuthController.COOKIE_NAME, "extension-refresh")))
            .andExpect(status().isOk)
            .andExpect(cookie().value(ExtensionAuthController.COOKIE_NAME, "next-refresh"))
    }

    @Test
    fun `origin checks still protect public cookie routes while bearer APIs remain protected`() {
        mvc.perform(post("$BASE/extension/refresh").contextPath(BASE)
            .cookie(Cookie(ExtensionAuthController.COOKIE_NAME, "extension-refresh")))
            .andExpect(status().isForbidden)
        mvc.perform(post("$BASE/extension/refresh").contextPath(BASE)
            .header(HttpHeaders.ORIGIN, "https://app.mossy.test")
            .cookie(Cookie(ExtensionAuthController.COOKIE_NAME, "extension-refresh")))
            .andExpect(status().isForbidden)
        mvc.perform(get("$BASE/user/me").contextPath(BASE))
            .andExpect(status().isUnauthorized)
        verifyNoInteractions(jwt)
    }

    @Test
    fun `extension can clear an expired session without a bearer header`() {
        mvc.perform(post("$BASE/extension/logout").contextPath(BASE).header(HttpHeaders.ORIGIN, ORIGIN))
            .andExpect(status().isOk)
            .andExpect(cookie().maxAge(ExtensionAuthController.COOKIE_NAME, 0))
    }

    @Configuration(proxyBeanMethods = false)
    @EnableWebMvc
    @Import(SecurityConfiguration::class, ExtensionAuthController::class,
        SecurityControllerAdvice::class, GlobalControllerAdvice::class)
    class TestConfiguration {
        @Bean fun users(): UserService = mock()
        @Bean fun jwt(): JwtManagementService = mock()
        @Bean fun decoder(): JwtDecoder = mock()
        @Bean fun converter() = JwtAuthenticationConverter()
        @Bean fun cookies() = CookiesConfigurationProperties()
        @Bean fun tokens() = JwtConfigurationProperties()
        @Bean fun origins() = ExtensionAuthOriginPolicy(ExtensionAuthProperties().apply {
            allowedOrigins = listOf(ORIGIN)
        })
        @Bean fun securityProperties() = SecurityConfigurationProperties().apply {
            val defaults = Properties().apply {
                ExtensionAuthSecurityTest::class.java.getResourceAsStream("/application.properties")!!.use { load(it) }
            }
            publicRoutesPatterns = defaults.getProperty("mossy.security.public-routes-patterns").split(",")
        }
        @Bean fun corsConfigurationSource() = CorsConfigurationSource {
            CorsConfiguration().apply {
                allowedOrigins = listOf("https://app.mossy.test")
                allowedMethods = listOf("POST", "GET", "OPTIONS")
            }
        }
    }

    companion object {
        private const val BASE = "/api/v1/auth"
        private const val ORIGIN = "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
}
