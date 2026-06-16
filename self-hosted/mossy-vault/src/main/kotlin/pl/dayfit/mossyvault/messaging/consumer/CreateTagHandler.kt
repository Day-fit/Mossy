package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.request.type.CreateTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.CreateTagResponseType
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.model.PasswordTag
import pl.dayfit.mossyvault.repository.PasswordTagRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus

@Component
class CreateTagHandler(
    private val passwordTagRepository: PasswordTagRepository,
    private val stompSessionRegistry: StompSessionRegistry
) : AbstractVaultRequestHandler<CreateTagRequestType>(CreateTagRequestType::class) {
    private val logger = org.slf4j.LoggerFactory.getLogger(CreateTagHandler::class.java)

    override fun handle(message: VaultRequestMessageDto<CreateTagRequestType>, headers: StompHeaders) {
        val payload = message.payload
        val name = payload.name

        val tag = PasswordTag(
            name = name,
            color = payload.color
        )

        val messageId = message.messageId

        try {
            passwordTagRepository.save(tag)

            stompSessionRegistry.send(
                StompEndpoints.USER_TAG_SAVED,
                VaultResponseMessageDto(
                    messageId,
                    CreateTagResponseType(
                        tag.id,
                    ),
                    VaultResponseStatus.OK
                )
            )
        } catch (_: DataIntegrityViolationException) {
            logger.warn("Tag with name {} already exists, skipping", name)
            stompSessionRegistry.send(
                StompEndpoints.USER_TAG_SAVED,
                VaultResponseMessageDto(
                    messageId,
                    CreateTagResponseType(),
                    VaultResponseStatus.ALREADY_EXISTS
                )
            )
        }
    }

    override fun getDestination(): String {
        return StompEndpoints.SUBSCRIBE_CREATE_TAG
    }
}