package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.request.type.CreateTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.SaveTagResponseType
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.model.PasswordTag
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import java.lang.reflect.Type
import kotlin.jvm.optionals.getOrNull

@Component
class SaveTagHandler(
    private val passwordEntryRepository: PasswordEntryRepository,
    private val stompSessionRegistry: StompSessionRegistry
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(SaveTagHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return CreateTagRequestType::class.java
    }

    @Suppress("UNCHECKED_CAST")
    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val requestDto = payload as? VaultRequestMessageDto<CreateTagRequestType> ?: run {
            logger.warn("Received invalid payload, ignoring it")
            return
        }

        val requestPayload = requestDto.payload

        passwordEntry.tags.addLast(
            PasswordTag(
                name = requestPayload.name,
                color = requestPayload.color,
            )
        )

        try {
            passwordEntryRepository.save(passwordEntry)
        } catch (_: DataIntegrityViolationException) {
            logger.warn("Tag with name {} already exists, skipping", requestPayload.name)
            stompSessionRegistry.send(
                StompEndpoints.USER_TAG_SAVED,
                VaultResponseMessageDto(
                    requestDto.messageId,
                    SaveTagResponseType(
                        requestPayload.passwordId,
                    ),
                    VaultResponseStatus.ALREADY_EXISTS
                )
            )
        }
    }
}