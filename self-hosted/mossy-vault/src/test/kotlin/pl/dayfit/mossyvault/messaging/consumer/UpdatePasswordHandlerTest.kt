package pl.dayfit.mossyvault.messaging.consumer

import messaging.request.VaultRequestMessageDto
import messaging.request.type.UpdatePasswordRequestType
import messaging.response.VaultResponseMessageDto
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.messaging.simp.stomp.StompHeaders
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.service.PasswordEntryService
import pl.dayfit.mossyvault.service.StompSessionRegistry
import type.VaultResponseStatus
import java.util.UUID
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlin.test.assertEquals

@OptIn(ExperimentalEncodingApi::class)
class UpdatePasswordHandlerTest {

    private val passwordEntryService: PasswordEntryService = org.mockito.kotlin.mock()
    private val stompSessionRegistry: StompSessionRegistry = org.mockito.kotlin.mock()

    private val handler = UpdatePasswordHandler(passwordEntryService, stompSessionRegistry)

    @Test
    fun `updates and sends OK when payload is valid`() {
        val vaultId = UUID.randomUUID()
        val correlationId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()

        whenever(passwordEntryService.update(any(), any())).thenReturn(passwordId)

        val requestType = UpdatePasswordRequestType(
            passwordId = passwordId,
            identifier = "john@example.com",
            address = "example.com",
            cipherText = Base64.encode("cipher".toByteArray())
        )
        val request = VaultRequestMessageDto(
            correlationId = correlationId,
            vaultId = vaultId,
            payload = requestType
        )

        handler.handleFrame(StompHeaders(), request)

        verify(passwordEntryService, times(1)).update(eq(requestType), any())

        val ackCaptor = argumentCaptor<VaultResponseMessageDto<*>>()
        verify(stompSessionRegistry, times(1)).send(eq(StompEndpoints.USER_PASSWORD_UPDATED), ackCaptor.capture())

        val ack = ackCaptor.firstValue
        assertEquals(VaultResponseStatus.OK, ack.status)
        assertEquals(request.messageId, ack.messageId)
    }

    @Test
    fun `sends ERROR when repository update fails`() {
        whenever(passwordEntryService.update(any(), any())).thenThrow(RuntimeException("db down"))

        val vaultId = UUID.randomUUID()
        val correlationId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()
        val requestType = UpdatePasswordRequestType(
            passwordId = passwordId,
            identifier = "john@example.com",
            address = "example.com",
            cipherText = Base64.encode("cipher".toByteArray())
        )
        val request = VaultRequestMessageDto(
            correlationId = correlationId,
            vaultId = vaultId,
            payload = requestType
        )

        handler.handleFrame(StompHeaders(), request)

        val ackCaptor = argumentCaptor<VaultResponseMessageDto<*>>()
        verify(stompSessionRegistry, times(1)).send(eq(StompEndpoints.USER_PASSWORD_UPDATED), ackCaptor.capture())

        val errorAck = ackCaptor.firstValue
        assertEquals(VaultResponseStatus.ERROR, errorAck.status)
        assertEquals(request.messageId, errorAck.messageId)
    }
}
