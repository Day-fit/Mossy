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
import kotlin.test.assertFailsWith

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
        assertEquals(properties.allowedOrigins, corsConfiguration.allowedOriginPatterns)
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
        assertEquals(listOf("*"), corsConfiguration.allowedOriginPatterns)
    }

    @Test
    fun `approved extension preflight permits bearer enrollment headers without cookies`() {
        val origin = "chrome-extension://" + "a".repeat(32)
        val properties = SecurityConfigurationProperties().apply {
            allowedOrigins = listOf("https://app.mossy.test")
            extensionAllowedOrigins = listOf(origin)
            extensionAllowedPaths = listOf("/device/enrollment")
        }
        val request = MockHttpServletRequest("OPTIONS", "/api/v1/device-trust/device/enrollment").apply {
            contextPath = "/api/v1/device-trust"
            servletPath = "/device/enrollment"
            addHeader("Origin", origin)
            addHeader("Access-Control-Request-Method", "POST")
            addHeader("Access-Control-Request-Headers", "authorization,content-type,idempotency-key")
        }
        val response = MockHttpServletResponse()
        CorsFilter(httpConfiguration.corsConfigurationSource(properties)).doFilter(request, response, MockFilterChain())

        assertEquals(200, response.status)
        assertEquals(origin, response.getHeader("Access-Control-Allow-Origin"))
        assertEquals(null, response.getHeader("Access-Control-Allow-Credentials"))
        assertEquals("authorization, content-type, idempotency-key", response.getHeader("Access-Control-Allow-Headers"))
    }

    @Test
    fun `extension API origin and route allowlists deny actual requests even with wildcard web fallback`() {
        val origin = "chrome-extension://" + "a".repeat(32)
        val properties = SecurityConfigurationProperties().apply {
            extensionAllowedOrigins = listOf(origin)
            extensionAllowedPaths = listOf("/user/me")
        }
        val source = httpConfiguration.corsConfigurationSource(properties)
        for ((path, sender) in listOf(
            "/login" to origin,
            "/refresh" to origin,
            "/logout" to origin,
            "/user/me" to ("chrome-extension://" + "b".repeat(32)),
        )) {
            val request = MockHttpServletRequest("POST", path).apply { addHeader("Origin", sender) }
            val response = MockHttpServletResponse()
            CorsFilter(source).doFilter(request, response, MockFilterChain())
            assertEquals(403, response.status, "$sender must not use $path")
        }
    }

    @Test
    fun `resource services reject malformed extension origin configuration`() {
        for (origin in listOf("*", "chrome-extension://*", "https://app.mossy.test", "chrome-extension://short")) {
            assertFailsWith<IllegalArgumentException> {
                httpConfiguration.corsConfigurationSource(SecurityConfigurationProperties().apply {
                    extensionAllowedOrigins = listOf(origin)
                })
            }
        }
    }
}
