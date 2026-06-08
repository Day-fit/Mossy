package messaging.request.type

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(value = SavePasswordRequestType::class, name = "SAVE_PASSWORD"),
    JsonSubTypes.Type(value = DeletePasswordRequestType::class, name = "DELETE_PASSWORD"),
    JsonSubTypes.Type(value = MetadataRequestType::class, name = "METADATA"),
    JsonSubTypes.Type(value = CiphertextRequestType::class, name = "CIPHERTEXT"),
    JsonSubTypes.Type(value = CreateTagRequestType::class, name = "SAVE_TAG"),
    JsonSubTypes.Type(value = AssignTagRequestType::class, name = "ASSIGN_TAG"),
    JsonSubTypes.Type(value = GetTagsRequestType::class, name = "GET_TAGS")
)
abstract class AbstractVaultRequestType