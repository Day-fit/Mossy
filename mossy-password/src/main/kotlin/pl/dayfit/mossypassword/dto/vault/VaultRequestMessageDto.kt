package pl.dayfit.mossypassword.dto.vault

import pl.dayfit.mossypassword.dto.vault.type.AbstractVaultRequestType
import java.util.UUID
import kotlin.reflect.KClass

data class VaultRequestMessageDto <out T: AbstractVaultRequestType> (
    val correlationId: UUID,
    val vaultId: UUID,
    val payload: T,
) {
    val type: KClass<out T> = payload::class
}