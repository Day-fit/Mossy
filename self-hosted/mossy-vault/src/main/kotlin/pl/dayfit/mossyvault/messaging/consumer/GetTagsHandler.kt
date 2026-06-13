package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.response.VaultResponseMessageDto
import messaging.response.type.GetTagsResponseType
import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordTagRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import java.lang.reflect.Type

@Component
class GetTagsHandler(
    private val passwordTagRepository: PasswordTagRepository,
    private val stompSessionRegistry: StompSessionRegistry
) : StompFrameHandler {
    override fun getPayloadType(headers: StompHeaders): Type {
        return VaultRequestMessageDto::class.java
    }

    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        if (payload !is VaultRequestMessageDto<*>) return

        stompSessionRegistry.send(
            StompEndpoints.USER_TAGS_RETRIEVED,
            VaultResponseMessageDto(
                payload.messageId,
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
}