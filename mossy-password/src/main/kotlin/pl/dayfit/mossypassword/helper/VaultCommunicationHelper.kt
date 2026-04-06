package pl.dayfit.mossypassword.helper

import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class VaultCommunicationHelper {
    fun extractVaultIdFromStompHeaders(headers: StompHeaders): UUID? {
        return runCatching {
            headers.getFirst("vaultId")
                ?.let { UUID.fromString(it) }
        }
            .getOrNull()
    }
}