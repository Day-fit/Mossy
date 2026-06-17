package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.request.type.SaveNoteRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.SaveNoteResponseType
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.model.PasswordNote
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import kotlin.io.encoding.Base64

@Component
class SaveNoteHandler(
    private val passwordEntryRepository: PasswordEntryRepository,
    private val stompSessionRegistry: StompSessionRegistry
) : AbstractVaultRequestHandler<SaveNoteRequestType>(SaveNoteRequestType::class) {
    private val logger = org.slf4j.LoggerFactory.getLogger(SaveNoteHandler::class.java)

    @Transactional
    override fun handle(message: VaultRequestMessageDto<SaveNoteRequestType>, headers: StompHeaders) {
        val payload = message.payload

        val passwordEntry = passwordEntryRepository.findById(payload.passwordId)
            .orElse(null)

        if (passwordEntry == null) {
            logger.warn("Password entry not found, id={}", payload.passwordId)
            return
        }

        val noteEntity = passwordEntry.note

        if (noteEntity == null) {
            logger.debug("Note entity is null, creating new one")

            val newNoteEntity = PasswordNote()
            newNoteEntity.content = Base64.decode(payload.note)

            passwordEntry.note = newNoteEntity
        } else {
            noteEntity.content = Base64.decode(payload.note)
        }

        passwordEntryRepository.save(passwordEntry)
        stompSessionRegistry.send(
            StompEndpoints.USER_NOTE_SAVED,
            VaultResponseMessageDto(
                message.messageId,
                SaveNoteResponseType(),
                VaultResponseStatus.OK
            )
        )
    }

    override fun getDestination(): String {
        return StompEndpoints.SUBSCRIBE_SAVE_NOTE
    }
}
