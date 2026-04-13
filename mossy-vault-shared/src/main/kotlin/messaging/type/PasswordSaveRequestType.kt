package messaging.type

import type.PasswordSaveType

data class PasswordSaveRequestType(
    val identifier: String,
    val domain: String,
    val cipherText: String,
    val saveType: PasswordSaveType
) : AbstractVaultRequestType()