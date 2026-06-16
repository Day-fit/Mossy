package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.request.type.GetNoteRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.GetNoteResponseType
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import kotlin.io.encoding.Base64
import kotlin.jvm.optionals.getOrNull

@Component
class GetNoteHandler(
    private val passwordEntryRepository: PasswordEntryRepository,
    private val stompSessionRegistry: StompSessionRegistry,
) : AbstractVaultRequestHandler<GetNoteRequestType>(GetNoteRequestType::class) {
    private val logger = org.slf4j.LoggerFactory.getLogger(GetNoteHandler::class.java)

    override fun handle(message: VaultRequestMessageDto<GetNoteRequestType>, headers: StompHeaders) {
        val payload = message.payload
        val passwordEntry = passwordEntryRepository.findById(payload.passwordId)
            .getOrNull()

        if (passwordEntry == null) {
            logger.warn("Password entry not found, id={}", payload.passwordId)
            return
        }

        stompSessionRegistry.send(
            StompEndpoints.USER_NOTE_RETRIEVED,
            VaultResponseMessageDto(
                message.messageId,
                GetNoteResponseType(
                    passwordEntry.note
                        ?.content
                        ?.let { Base64.encode(it) }
                ),
                VaultResponseStatus.OK
            )
        )
    }

    override fun getDestination(): String {
        return StompEndpoints.SUBSCRIBE_GET_NOTE
    }
}