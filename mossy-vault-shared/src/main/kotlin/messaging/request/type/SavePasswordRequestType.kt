package messaging.request.type

import type.MessageType
import type.PasswordSaveType
import type.PasswordType

data class SavePasswordRequestType(
    val identifier: String,
    val address: String,
    val cipherText: String,
    val saveType: PasswordSaveType,
    val passwordType: PasswordType?,
    override val type: MessageType = MessageType.SAVE_PASSWORD
) : VaultRequestType()