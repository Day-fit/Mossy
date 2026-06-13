package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.request.type.CreateTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.CreateTagResponseType
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.model.PasswordTag
import pl.dayfit.mossyvault.repository.PasswordTagRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import java.lang.reflect.Type

@Component
class CreateTagHandler(
    private val passwordTagRepository: PasswordTagRepository,
    private val stompSessionRegistry: StompSessionRegistry
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(CreateTagHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return VaultRequestMessageDto::class.java
    }

    @Suppress("UNCHECKED_CAST")
    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val requestDto = payload as? VaultRequestMessageDto<CreateTagRequestType> ?: run {
            logger.warn("Received invalid payload, ignoring it")
            return
        }

        val requestPayload = requestDto.payload

        val tag = PasswordTag(
            name = requestPayload.name,
            color = requestPayload.color
        )

        try {
            passwordTagRepository.save(tag)

            stompSessionRegistry.send(
                StompEndpoints.USER_TAG_SAVED,
                VaultResponseMessageDto(
                    requestDto.messageId,
                    CreateTagResponseType(
                        tag.id,
                    ),
                    VaultResponseStatus.OK
                )
            )
        } catch (_: DataIntegrityViolationException) {
            logger.warn("Tag with name {} already exists, skipping", requestPayload.name)
            stompSessionRegistry.send(
                StompEndpoints.USER_TAG_SAVED,
                VaultResponseMessageDto(
                    requestDto.messageId,
                    CreateTagResponseType(),
                    VaultResponseStatus.ALREADY_EXISTS
                )
            )
        }
    }
}