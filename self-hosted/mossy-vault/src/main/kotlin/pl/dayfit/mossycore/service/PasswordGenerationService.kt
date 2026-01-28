package pl.dayfit.mossycore.service

import org.springframework.stereotype.Service
import pl.dayfit.mossycore.configuration.properties.PasswordConfigurationProperties
import java.security.SecureRandom
import java.util.Base64

@Service
class PasswordGenerationService(
    private val secureRandom: SecureRandom,
    private val passwordConfigurationProperties: PasswordConfigurationProperties
) {
    fun generatePassword(): String {
        return secureToken(
            passwordConfigurationProperties.lengthInBytes
        )
    }

    /**
     * Generates a secure, random token encoded as a Base64 string without padding.
     *
     * @param bytes The number of random bytes to generate for the token.
     * @return The Base64 encoded secure token as a string.
     */
    private fun secureToken(bytes: Int): String {
        val bytes = ByteArray(bytes)
        secureRandom.nextBytes(bytes)

        return Base64.getEncoder()
            .withoutPadding()
            .encodeToString(bytes)
    }
}