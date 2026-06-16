package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.request.type.GetTagsRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.GetTagsResponseType
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordTagRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus

@Component
class GetTagsHandler(
    private val passwordTagRepository: PasswordTagRepository,
    private val stompSessionRegistry: StompSessionRegistry
) : AbstractVaultRequestHandler<GetTagsRequestType>(GetTagsRequestType::class) {

    override fun handle(
        message: VaultRequestMessageDto<GetTagsRequestType>,
        headers: StompHeaders
    ) {
        stompSessionRegistry.send(
            StompEndpoints.USER_TAGS_RETRIEVED,
            VaultResponseMessageDto(
                message.messageId,
                GetTagsResponseType(
                    passwordTagRepository.findAll().map {
                        GetTagsResponseType.Tag(
                            it.id!!,
                            it.name,
                            it.color
                        )
                    }
                ),
                VaultResponseStatus.OK
            )
        )
    }

    override fun getDestination(): String {
        return StompEndpoints.SUBSCRIBE_GET_TAGS
    }
}