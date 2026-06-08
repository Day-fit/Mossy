package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.request.type.AssignTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.AssignTagResponseType
import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.repository.PasswordTagRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import java.lang.reflect.Type
import kotlin.jvm.optionals.getOrElse

@Component
class AssignTagHandler(
    private val passwordTagRepository: PasswordTagRepository,
    private val passwordEntryRepository: PasswordEntryRepository,
    private val stompSessionRegistry: StompSessionRegistry
) : StompFrameHandler {
    private val logger = org.slf4j.LoggerFactory.getLogger(AssignTagHandler::class.java)

    override fun getPayloadType(headers: StompHeaders): Type {
        return AssignTagRequestType::class.java
    }

    @Suppress("UNCHECKED_CAST")
    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        val requestDto = payload as? VaultRequestMessageDto<AssignTagRequestType> ?: run {
            logger.warn("Received invalid payload, ignoring it")
            return
        }

        val requestPayload = requestDto.payload

        val tag =  passwordTagRepository.findById(requestPayload.tagId)
            .getOrElse {
                stompSessionRegistry.send(
                    StompEndpoints.USER_TAG_ASSIGNED,
                    VaultResponseMessageDto(
                        requestDto.messageId,
                        AssignTagResponseType(),
                        VaultResponseStatus.NOT_FOUND
                    )
                )
                return
            }

        val passwordEntry = passwordEntryRepository.findById(requestPayload.passwordId)
            .getOrElse {
                stompSessionRegistry.send(
                    StompEndpoints.USER_TAG_ASSIGNED,
                    VaultResponseMessageDto(
                        requestDto.messageId,
                        AssignTagResponseType(),
                        VaultResponseStatus.NOT_FOUND
                    ))
                return
            }

        passwordEntry.tags
            .add(tag)

        passwordEntryRepository.save(passwordEntry)
    }
}