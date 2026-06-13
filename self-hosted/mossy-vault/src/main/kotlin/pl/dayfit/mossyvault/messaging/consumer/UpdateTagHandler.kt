package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.request.type.UpdateTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.UpdateTagResponseType
import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordTagRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import java.lang.reflect.Type
import kotlin.jvm.optionals.getOrNull

@Component
class UpdateTagHandler(
    private val stompSessionRegistry: StompSessionRegistry,
    private val passwordTagRepository: PasswordTagRepository
) : StompFrameHandler {
    private val log = org.slf4j.LoggerFactory.getLogger(UpdateTagHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return VaultRequestMessageDto::class.java
    }

    @Suppress("UNCHECKED_CAST")
    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val requestDto = payload as? VaultRequestMessageDto<UpdateTagRequestType>

        if (requestDto == null) {
            log.warn("Received invalid payload, ignoring it")
            return
        }

        val tagEntry = passwordTagRepository.findById(requestDto.payload.tagId)
            .getOrNull()

        if (tagEntry == null) {
            log.warn("Tag entry not found, id={}", requestDto.payload.tagId)
            return
        }

        val newColor = requestDto.payload.color
        if (newColor != null) {
            tagEntry.color = newColor
        }

        val newName = requestDto.payload.name
        if (newName != null) {
            tagEntry.name = newName
        }

        passwordTagRepository.save(tagEntry)

        stompSessionRegistry.send(
            StompEndpoints.USER_TAG_UPDATED,
            VaultResponseMessageDto(
                requestDto.messageId,
                UpdateTagResponseType(),
                VaultResponseStatus.OK
            )
        )
    }
}