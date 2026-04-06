package pl.dayfit.mossypassword.dto.vault

import java.util.UUID
import kotlin.reflect.KClass

data class VaultResponseMessageDto<T: AbstractVaultResponseType>(
    val messageId: UUID,
    val type: KClass<T>,
    val payload: T
)