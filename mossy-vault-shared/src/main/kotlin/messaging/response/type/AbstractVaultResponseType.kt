package messaging.response.type

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(value = SavePasswordResponseType::class, name = "SAVE_PASSWORD"),
    JsonSubTypes.Type(value = DeletePasswordResponseType::class, name = "DELETE_PASSWORD"),
    JsonSubTypes.Type(value = MetadataResponseType::class, name = "METADATA"),
    JsonSubTypes.Type(value = CiphertextResponseType::class, name = "CIPHERTEXT"),
    JsonSubTypes.Type(value = CreateTagResponseType::class, name = "SAVE_TAG"),
    JsonSubTypes.Type(value = AssignTagResponseType::class, name = "ASSIGN_TAG"),
    JsonSubTypes.Type(value = GetTagsResponseType::class, name = "GET_TAGS"),
)
abstract class AbstractVaultResponseType