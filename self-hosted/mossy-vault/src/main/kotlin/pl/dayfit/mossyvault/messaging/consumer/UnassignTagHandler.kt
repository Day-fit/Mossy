package pl.dayfit.mossyvault.messaging.consumer

import jakarta.transaction.Transactional
import messaging.request.VaultRequestMessageDto
import messaging.request.type.UnassignTagRequestType
import messaging.response.VaultResponseMessageDto
import messaging.response.type.UnassignTagResponseType
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.repository.PasswordTagRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import kotlin.jvm.optionals.getOrElse

@Component
class UnassignTagHandler(
    private val passwordTagRepository: PasswordTagRepository,
    private val passwordEntryRepository: PasswordEntryRepository,
    private val stompSessionRegistry: StompSessionRegistry
) : AbstractVaultRequestHandler<UnassignTagRequestType>(UnassignTagRequestType::class) {

    @Transactional
    override fun handle(message: VaultRequestMessageDto<UnassignTagRequestType>, headers: StompHeaders) {
        val payload = message.payload
        val messageId = message.messageId

        val tag = passwordTagRepository.findById(payload.tagId)
            .getOrElse {
                stompSessionRegistry.send(
                    StompEndpoints.USER_TAG_UNASSIGNED,
                    VaultResponseMessageDto(
                        messageId,
                        UnassignTagResponseType(),
                        VaultResponseStatus.NOT_FOUND
                    )
                )
                return
            }

        val passwordEntry = passwordEntryRepository.findById(payload.passwordId)
            .getOrElse {
                stompSessionRegistry.send(
                    StompEndpoints.USER_TAG_UNASSIGNED,
                    VaultResponseMessageDto(
                        messageId,
                        UnassignTagResponseType(),
                        VaultResponseStatus.NOT_FOUND
                    ))
                return
            }

        passwordEntry.tags
            .remove(tag)

        passwordEntryRepository.save(passwordEntry)

        stompSessionRegistry.send(
            StompEndpoints.USER_TAG_UNASSIGNED,
            VaultResponseMessageDto(
                messageId,
                UnassignTagResponseType(),
                VaultResponseStatus.OK
            )
        )
    }

    override fun getDestination(): String {
        return StompEndpoints.SUBSCRIBE_UNASSIGN_TAG
    }
}

