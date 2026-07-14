package pl.dayfit.mossyauthstarter.configuration

import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockHttpServletRequest
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
        assertEquals(properties.allowedOrigins, corsConfiguration.allowedOriginPatterns)
        assertEquals(
            listOf("GET", "POST", "PUT", "DELETE", "OPTIONS"),
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
}
