package pl.dayfit.mossyauthstarter.configuration

import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.mock.web.MockFilterChain
import org.springframework.web.filter.CorsFilter
import org.springframework.security.oauth2.jwt.Jwt
import pl.dayfit.mossyauthstarter.configuration.properties.SecurityConfigurationProperties
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class HttpConfigurationTest {
    private val httpConfiguration = HttpConfiguration()

    @Test
    fun `jwt converter maps roles claim to Spring Security authorities`() {
        val jwt = Jwt.withTokenValue("token")
            .header("alg", "none")
            .claim("roles", listOf("USER", "ADMIN"))
            .build()

        val authentication = httpConfiguration.jwtAuthenticationConverter().convert(jwt)

        assertNotNull(authentication)
        assertEquals(
            setOf("ROLE_USER", "ROLE_ADMIN"),
            authentication.authorities
                .mapNotNull { it.authority }
                .filter { it.startsWith("ROLE_") }
                .toSet()
        )
    }

    @Test
    fun `cors configuration uses configured allowed origins`() {
        val properties = SecurityConfigurationProperties().apply {
            allowedOrigins = listOf("https://app.mossy.test", "https://admin.mossy.test")
        }

        val corsConfiguration = httpConfiguration.corsConfigurationSource(properties)
            .getCorsConfiguration(MockHttpServletRequest("OPTIONS", "/api/dashboard"))

        assertNotNull(corsConfiguration)
        assertEquals(properties.allowedOrigins + "chrome-extension://*", corsConfiguration.allowedOriginPatterns)
        assertEquals(
            listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"),
            corsConfiguration.allowedMethods
        )
        assertEquals(true, corsConfiguration.allowCredentials)
    }

    @Test
    fun `cors configuration allows all origins when none are configured`() {
        val corsConfiguration = httpConfiguration
            .corsConfigurationSource(SecurityConfigurationProperties())
            .getCorsConfiguration(MockHttpServletRequest("OPTIONS", "/api/dashboard"))

        assertNotNull(corsConfiguration)
        assertNotNull(corsConfiguration.checkOrigin("https://consumer.example"))
    }

    @Test
    fun `any extension can preflight any endpoint with bearer and session headers`() {
        val properties = SecurityConfigurationProperties().apply {
            allowedOrigins = listOf("https://app.mossy.test")
        }
        val filter = CorsFilter(httpConfiguration.corsConfigurationSource(properties))

        for (origin in listOf("a", "b").map { "chrome-extension://${it.repeat(32)}" }) {
            for (path in listOf("/extension/login", "/extension/refresh", "/extension/logout", "/user/me", "/consumer/endpoint")) {
                val request = MockHttpServletRequest("OPTIONS", "/api/v1/auth$path").apply {
                    contextPath = "/api/v1/auth"
                    servletPath = path
                    addHeader("Origin", origin)
                    addHeader("Access-Control-Request-Method", "POST")
                    addHeader("Access-Control-Request-Headers", "authorization,content-type,idempotency-key")
                }
                val response = MockHttpServletResponse()

                filter.doFilter(request, response, MockFilterChain())

                assertEquals(200, response.status, "$origin should be able to use $path")
                assertEquals(origin, response.getHeader("Access-Control-Allow-Origin"))
                assertEquals("true", response.getHeader("Access-Control-Allow-Credentials"))
                assertEquals("authorization, content-type, idempotency-key", response.getHeader("Access-Control-Allow-Headers"))
            }
        }
    }

    @Test
    fun `extension requests are allowed on all routes with configured web origins or wildcard fallback`() {
        for (webOrigins in listOf(emptyList(), listOf("https://app.mossy.test"))) {
            val properties = SecurityConfigurationProperties().apply { allowedOrigins = webOrigins }
            val filter = CorsFilter(httpConfiguration.corsConfigurationSource(properties))

            for (origin in listOf("a", "b").map { "chrome-extension://${it.repeat(32)}" }) {
                for (path in listOf("/login", "/refresh", "/logout", "/user/me", "/consumer/endpoint")) {
                    val request = MockHttpServletRequest("POST", path).apply {
                        addHeader("Origin", origin)
                    }
                    val response = MockHttpServletResponse()
                    val chain = MockFilterChain()

                    filter.doFilter(request, response, chain)

                    assertEquals(200, response.status, "$origin should be able to use $path")
                    assertEquals(origin, response.getHeader("Access-Control-Allow-Origin"))
                    assertNotNull(chain.request)
                }
            }
        }
    }
}
