package pl.dayfit.mossypassword.service

import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import pl.dayfit.mossypassword.dto.request.VaultRegistrationRequestDto
import pl.dayfit.mossypassword.dto.response.VaultRegistrationResponseDto
import pl.dayfit.mossypassword.model.Vault
import pl.dayfit.mossypassword.repository.VaultRepository
import java.security.SecureRandom
import java.util.UUID
import kotlin.io.encoding.Base64

@Service
class VaultAuthService(
    private val vaultRepository: VaultRepository,
    private val passwordEncoder: PasswordEncoder,
    private val secureRandom: SecureRandom
) {

    fun register(userId: UUID, dto: VaultRegistrationRequestDto): VaultRegistrationResponseDto {
        val rawSecret = generateApiKey()
        val secretHash = passwordEncoder.encode(rawSecret)!! //if rawSecret is not nullable, a result cannot be null
        val createdVault = vaultRepository.save(
            Vault(
                ownerId = userId,
            name = dto.vaultName,
            secretHash = secretHash
        ,
                vaultName = "vault"
            )
        )

        val vault = createdVault.apply {
            vaultName = "Vault-${id.toString().take(8)}"
        }
        vaultRepository.save(vault)

        return VaultRegistrationResponseDto(
            vaultId = vault.id!!,
            apiKey = rawSecret
        )
    }

    fun validate(vaultId: UUID, secret: String): Boolean {
        val vault = vaultRepository.findById(vaultId).orElse(null) ?: return false
        return passwordEncoder.matches(secret, vault.secretHash)
    }

    private fun generateApiKey(): String {
        val bytes = ByteArray(32)
        secureRandom.nextBytes(bytes)
        return Base64.UrlSafe
            .withPadding(Base64.PaddingOption.ABSENT)
            .encode(bytes)
    }
}
