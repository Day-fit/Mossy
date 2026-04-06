package pl.dayfit.mossypassword.dto.vault

import java.util.UUID
import kotlin.reflect.KClass

data class VaultRequestMessageDto <T: AbstractVaultRequestType> (
    val correlationId: UUID,
    val vaultId: UUID,
    val type: KClass<T>,
    val payload: T
)