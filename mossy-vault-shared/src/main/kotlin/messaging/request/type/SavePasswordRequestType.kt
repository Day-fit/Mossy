package messaging.request.type

import type.PasswordSaveType

data class SavePasswordRequestType(
    val identifier: String,
    val domain: String,
    val cipherText: String,
    val saveType: PasswordSaveType
) : AbstractVaultRequestType()