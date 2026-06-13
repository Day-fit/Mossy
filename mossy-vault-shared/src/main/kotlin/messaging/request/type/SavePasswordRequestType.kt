package messaging.request.type

import type.MessageType
import type.PasswordSaveType

data class SavePasswordRequestType(
    val identifier: String,
    val domain: String,
    val cipherText: String,
    val saveType: PasswordSaveType,
    override val type: MessageType = MessageType.SAVE_PASSWORD
) : VaultRequestType()