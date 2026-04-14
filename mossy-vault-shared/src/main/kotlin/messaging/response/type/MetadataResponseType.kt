package messaging.response.type

import messaging.request.PasswordMetadataDto

data class MetadataResponseType(
    val metadata: List<PasswordMetadataDto>
) : AbstractVaultResponseType()