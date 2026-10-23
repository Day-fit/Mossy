package pl.dayfit.mossyauth.configuration.properties

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "mossy.auth.extension")
class ExtensionAuthProperties {
    /** Exact packaged extension origins. An empty list disables extension sessions. */
    var allowedOrigins: List<String> = emptyList()
}
