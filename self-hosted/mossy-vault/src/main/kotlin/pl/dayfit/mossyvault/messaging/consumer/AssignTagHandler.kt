package pl.dayfit.mossyvault.messaging.consumer

import jakarta.transaction.Transactional
import messaging.request.VaultRequestMessageDto
import messaging.request.type.AssignTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.AssignTagResponseType
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.repository.PasswordTagRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import kotlin.jvm.optionals.getOrElse

@Component
class AssignTagHandler(
    private val passwordTagRepository: PasswordTagRepository,
    private val passwordEntryRepository: PasswordEntryRepository,
    private val stompSessionRegistry: StompSessionRegistry
) : AbstractVaultRequestHandler<AssignTagRequestType>(AssignTagRequestType::class) {

    @Transactional
    override fun handle(message: VaultRequestMessageDto<AssignTagRequestType>, headers: StompHeaders) {
        val payload = message.payload
        val tag =  passwordTagRepository.findById(payload.tagId)
            .getOrElse {
                stompSessionRegistry.send(
                    StompEndpoints.USER_TAG_ASSIGNED,
                    VaultResponseMessageDto(
                        message.messageId,
                        AssignTagResponseType(),
                        VaultResponseStatus.NOT_FOUND
                    )
                )
                return
            }

        val passwordEntry = passwordEntryRepository.findById(payload.passwordId)
            .getOrElse {
                stompSessionRegistry.send(
                    StompEndpoints.USER_TAG_ASSIGNED,
                    VaultResponseMessageDto(
                        message.messageId,
                        AssignTagResponseType(),
                        VaultResponseStatus.NOT_FOUND
                    ))
                return
            }

        passwordEntry.tags
            .add(tag)

        passwordEntryRepository.save(passwordEntry)

        stompSessionRegistry.send(
            StompEndpoints.USER_TAG_ASSIGNED,
            VaultResponseMessageDto(
                message.messageId,
                AssignTagResponseType(),
                VaultResponseStatus.OK
            )
        )
    }

    override fun getDestination(): String {
        return StompEndpoints.SUBSCRIBE_TAG_ASSIGN
    }
}