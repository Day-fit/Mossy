package pl.dayfit.mossypassword.messaging.resolver

import org.springframework.stereotype.Component
import pl.dayfit.mossypassword.dto.vault.type.AbstractVaultRequestType
import pl.dayfit.mossypassword.dto.vault.type.AbstractVaultResponseType
import pl.dayfit.mossypassword.dto.vault.VaultRequestMessageDto
import pl.dayfit.mossypassword.dto.vault.VaultResponseMessageDto
import java.util.concurrent.CompletableFuture

@Component
class MetadataMessageHandler : AbstractMessageHandler() {
    override fun <Req : AbstractVaultRequestType, Res : AbstractVaultResponseType> handleMessage(
        message: VaultRequestMessageDto<Req>
    ): CompletableFuture<VaultResponseMessageDto<Res>> {
    }

    override fun supportedType(): AbstractVaultRequestType {
        TODO("Not yet implemented")
    }

}