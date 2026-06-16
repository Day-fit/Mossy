package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.request.type.VaultRequestType
import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import pl.dayfit.mossyvault.exception.VaultRequestValidationFailedException
import java.lang.reflect.Type
import kotlin.reflect.KClass
import kotlin.reflect.cast

abstract class AbstractVaultRequestHandler<T : VaultRequestType>(
    private val payloadClass: KClass<T>
) : StompFrameHandler {
    override fun getPayloadType(headers: StompHeaders): Type =
        VaultRequestMessageDto::class.java

    override fun handleFrame(headers: StompHeaders, payload: Any?) {
        handle(validate(payload), headers)
    }

    private fun validate(payload: Any?): VaultRequestMessageDto<T> {
        val requestDto = payload as? VaultRequestMessageDto<*>
            ?: throw VaultRequestValidationFailedException(
                "Received invalid payload, ignoring it"
            )

        val requestPayload = payloadClass.cast(requestDto.payload)

        return VaultRequestMessageDto(
            messageId = requestDto.messageId,
            correlationId = requestDto.correlationId,
            vaultId = requestDto.vaultId,
            payload = requestPayload
        )
    }

    abstract fun handle(
        message: VaultRequestMessageDto<T>,
        headers: StompHeaders
    )

    abstract fun getDestination(): String
}