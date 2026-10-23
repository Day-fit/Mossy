package pl.dayfit.mossyauth.configuration

import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Component
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import pl.dayfit.mossyauth.configuration.properties.ExtensionAuthProperties

/** Cookie-authenticated extension routes have their own origin and CORS boundary. */
@Component
class ExtensionAuthOriginPolicy(private val properties: ExtensionAuthProperties) {
    init {
        require(properties.allowedOrigins.all { EXTENSION_ORIGIN.matches(it) }) {
            "Extension auth origins must be exact chrome-extension:// origins with a 32-character extension ID"
        }
    }

    fun requireAllowed(origin: String?) {
        if (origin == null || !EXTENSION_ORIGIN.matches(origin) || origin !in properties.allowedOrigins) {
            throw AccessDeniedException("Extension origin is not allowed")
        }
    }

    fun corsSource(fallback: CorsConfigurationSource): CorsConfigurationSource = CorsConfigurationSource { request ->
        val path = request.requestURI.removePrefix(request.contextPath)

        if (!path.startsWith("/extension/")) {
            return@CorsConfigurationSource fallback.getCorsConfiguration(request)
        }

        CorsConfiguration().apply {
            allowedOrigins = properties.allowedOrigins
            allowedMethods = listOf("POST", "OPTIONS")
            allowedHeaders = listOf("Content-Type", "Authorization")
            allowCredentials = true
            maxAge = 300
        }
    }

    companion object {
        private val EXTENSION_ORIGIN = Regex("chrome-extension://[a-p]{32}")
    }
}
