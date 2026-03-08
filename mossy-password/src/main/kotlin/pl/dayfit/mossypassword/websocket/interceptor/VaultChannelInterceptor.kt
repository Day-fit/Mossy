package pl.dayfit.mossypassword.websocket.interceptor

import org.slf4j.LoggerFactory
import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.ChannelInterceptor
import org.springframework.messaging.support.MessageHeaderAccessor
import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.service.VaultRegistrationService
import java.security.Principal
import java.util.UUID

@Component
class VaultChannelInterceptor(
    private val vaultRegistrationService: VaultRegistrationService
) : ChannelInterceptor {
    private val logger = LoggerFactory.getLogger(VaultChannelInterceptor::class.java)

    override fun preSend(message: Message<*>, channel: MessageChannel): Message<*>? {
        val accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor::class.java)

        if (accessor != null && StompCommand.CONNECT == accessor.command) {
            val vaultIdHeader = accessor.getFirstNativeHeader("vault-id")
            val vaultSecret = accessor.getFirstNativeHeader("vault-secret")

            if (vaultIdHeader == null || vaultSecret == null) {
                logger.warn("STOMP CONNECT rejected: missing vault-id or vault-secret headers")
                return null
            }

            val vaultId = runCatching { UUID.fromString(vaultIdHeader) }.getOrNull()
            if (vaultId == null) {
                logger.warn("STOMP CONNECT rejected: invalid vault-id format")
                return null
            }

            if (!vaultRegistrationService.validate(vaultId, vaultSecret)) {
                logger.warn("STOMP CONNECT rejected: invalid credentials for vault-id={}", vaultIdHeader)
                return null
            }

            accessor.user = Principal { vaultIdHeader }
            logger.debug("Vault authenticated successfully: vault-id={}", vaultIdHeader)
        }

        return message
    }
}
