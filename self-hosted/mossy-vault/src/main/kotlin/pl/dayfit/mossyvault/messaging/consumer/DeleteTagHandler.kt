package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.request.type.DeleteTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.DeleteTagResponseType
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordTagRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus

@Component
class DeleteTagHandler(
    private val passwordTagRepository: PasswordTagRepository,
    private val stompSessionRegistry: StompSessionRegistry
) : AbstractVaultRequestHandler<DeleteTagRequestType>(DeleteTagRequestType::class) {
    private val logger = org.slf4j.LoggerFactory.getLogger(DeleteTagHandler::class.java)

    override fun handle(message: VaultRequestMessageDto<DeleteTagRequestType>, headers: StompHeaders) {
        val payload = message.payload
        val tagId = payload.tagId
        val messageId = message.messageId

        if(!passwordTagRepository.existsById(tagId)) {
            logger.warn("Tag entry not found, id={}", tagId)
            stompSessionRegistry.send(
                StompEndpoints.USER_TAG_DELETED,
                VaultResponseMessageDto(
                    messageId,
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
                messageId,
                DeleteTagResponseType(),
                VaultResponseStatus.OK
            )
        )
    }

    override fun getDestination(): String {
        return StompEndpoints.SUBSCRIBE_DELETE_TAG
    }
}