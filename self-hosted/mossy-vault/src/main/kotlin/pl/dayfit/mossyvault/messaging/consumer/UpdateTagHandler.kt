package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.request.type.UpdateTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.UpdateTagResponseType
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordTagRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import kotlin.jvm.optionals.getOrNull

@Component
class UpdateTagHandler(
    private val stompSessionRegistry: StompSessionRegistry,
    private val passwordTagRepository: PasswordTagRepository
) : AbstractVaultRequestHandler<UpdateTagRequestType>(UpdateTagRequestType::class) {
    private val logger = org.slf4j.LoggerFactory.getLogger(UpdateTagHandler::class.java)

    override fun handle(message: VaultRequestMessageDto<UpdateTagRequestType>, headers: StompHeaders) {
        val payload = message.payload

        val tagEntry = passwordTagRepository.findById(payload.tagId)
            .getOrNull()

        if (tagEntry == null) {
            logger.warn("Tag entry not found, id={}", payload.tagId)
            return
        }

        val newColor = payload.color
        if (newColor != null) {
            tagEntry.color = newColor
        }

        val newName = payload.name
        if (newName != null) {
            tagEntry.name = newName
        }

        passwordTagRepository.save(tagEntry)

        stompSessionRegistry.send(
            StompEndpoints.USER_TAG_UPDATED,
            VaultResponseMessageDto(
                message.messageId,
                UpdateTagResponseType(),
                VaultResponseStatus.OK
            )
        )
    }

    override fun getDestination(): String {
        return StompEndpoints.SUBSCRIBE_UPDATE_TAG
    }
}