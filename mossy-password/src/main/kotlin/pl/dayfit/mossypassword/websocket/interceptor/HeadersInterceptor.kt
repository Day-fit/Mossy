package pl.dayfit.mossypassword.websocket.interceptor

import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.MessageDeliveryException
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.ChannelInterceptor
import org.springframework.messaging.support.MessageBuilder
import org.springframework.messaging.support.MessageHeaderAccessor
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class HeadersInterceptor : ChannelInterceptor {
    override fun preSend(message: Message<*>, channel: MessageChannel): Message<*> {
        val accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor::class.java)
            ?: return message

        when (accessor.command) {
            StompCommand.CONNECT -> {
                val vaultId = accessor.getFirstNativeHeader("vault-id")
                    ?: throw MessageDeliveryException(message, "Missing required header: vault-id")
                accessor.sessionAttributes?.set("vault-id", UUID.fromString(vaultId))
            }
            StompCommand.SEND -> {
                val vaultId = accessor.sessionAttributes?.get("vault-id") as? UUID
                    ?: throw MessageDeliveryException(message, "No vault-id in session")
                accessor.setHeader("vault-id", vaultId)
            }
            else -> {
                // Do nothing
            }
        }

        return MessageBuilder.createMessage(message.payload, accessor.messageHeaders)
    }
}