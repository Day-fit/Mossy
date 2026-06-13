package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.request.type.DeleteTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.DeleteTagResponseType
import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordTagRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import java.lang.reflect.Type

@Component
class DeleteTagHandler(
    private val passwordTagRepository: PasswordTagRepository,
    private val stompSessionRegistry: StompSessionRegistry
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(DeleteTagHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return VaultRequestMessageDto::class.java
    }

    @Suppress("UNCHECKED_CAST")
    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val requestDto = payload as? VaultRequestMessageDto<DeleteTagRequestType> ?: run {
            logger.warn("Received invalid payload, ignoring it")
            return
        }

        val tagId = requestDto.payload.tagId
        if(!passwordTagRepository.existsById(tagId)) {
            logger.warn("Tag entry not found, id={}", tagId)
            stompSessionRegistry.send(
                StompEndpoints.USER_TAG_DELETED,
                VaultResponseMessageDto(
                    requestDto.messageId,
                    DeleteTagResponseType(),
                    VaultResponseStatus.NOT_FOUND
                )
            )
            return
        }

        passwordTagRepository.deleteById(tagId)
        stompSessionRegistry.send(
            StompEndpoints.USER_TAG_DELETED,
            VaultResponseMessageDto(
                requestDto.messageId,
                DeleteTagResponseType(),
                VaultResponseStatus.OK
            )
        )
    }
}