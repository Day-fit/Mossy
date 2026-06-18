package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.response.VaultResponseMessageDto
import messaging.request.PasswordMetadataDto
import messaging.request.type.MetadataRequestType
import messaging.response.type.MetadataResponseType
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.stereotype.Component
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.repository.PasswordEntryRepository
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus

@Component
class MetadataHandler(
    private val passwordEntryRepository: PasswordEntryRepository,
    private val stompSessionRegistry: StompSessionRegistry
) : AbstractVaultRequestHandler<MetadataRequestType>(MetadataRequestType::class) {

    override fun handle(message: VaultRequestMessageDto<MetadataRequestType>, headers: StompHeaders) {
        val passwords = passwordEntryRepository.findAllBy()
        val metadata = passwords.map {
            PasswordMetadataDto(
                passwordId = requireNotNull(it.id) { "Password entry is missing id" },
                identifier = it.identifier,
                address = it.address,
                lastModified = it.lastModified,
                tags = it.tags.map { tag ->
                    PasswordMetadataDto.Tag(
                        tag.id!!,
                        tag.name,
                        tag.color
                    )
                },
                hasNote = it.note != null,
                passwordType = it.passwordType,
            )
        }

        val response = VaultResponseMessageDto(
            message.messageId,
            MetadataResponseType(metadata),
            VaultResponseStatus.OK
        )

        stompSessionRegistry.send(
            StompEndpoints.USER_METADATA_RETRIEVED,
            response
        )
    }

    override fun getDestination(): String {
        return StompEndpoints.SUBSCRIBE_METADATA
    }
}
