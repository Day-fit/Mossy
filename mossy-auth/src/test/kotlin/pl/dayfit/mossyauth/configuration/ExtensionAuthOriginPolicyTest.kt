package pl.dayfit.mossyauth.configuration

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import pl.dayfit.mossyauth.configuration.properties.ExtensionAuthProperties

class ExtensionAuthOriginPolicyTest {
    @Test
    fun `wildcard web and malformed origins fail configuration validation`() {
        val invalidOrigins = listOf(
            "*",
            "chrome-extension://*",
            "https://app.mossy.test",
            "chrome-extension://abc",
            "chrome-extension://${"z".repeat(32)}"
        )

        for (origin in invalidOrigins) {
            assertThrows<IllegalArgumentException> {
                val properties = ExtensionAuthProperties().apply {
                    allowedOrigins = listOf(origin)
                }

                ExtensionAuthOriginPolicy(properties)
            }
        }
    }
}
