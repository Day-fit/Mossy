package pl.dayfit.mossyvault.messaging.consumer

import messaging.VaultRequestMessageDto
import messaging.VaultResponseMessageDto
import messaging.request.type.SavePasswordRequestType
import type.VaultResponseStatus
import org.junit.jupiter.api.Test
import org.mockito.kotlin.*
import org.springframework.messaging.simp.stomp.StompHeaders
import pl.dayfit.mossyvault.configuration.StompEndpoints
import pl.dayfit.mossyvault.service.PasswordEntryService
import pl.dayfit.mossyvault.service.StompSessionRegistry
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

@OptIn(ExperimentalEncodingApi::class)
class SavePasswordHandlerTest {

    private val passwordEntryService: PasswordEntryService = mock()
    private val stompSessionRegistry: StompSessionRegistry = mock()

    private val handler = SavePasswordHandler(passwordEntryService, stompSessionRegistry)

    @Test
    fun `saves and sends OK when payload is valid`() {
        val vaultId = UUID.randomUUID()
        val correlationId = UUID.randomUUID()
        val savedPasswordId = UUID.randomUUID()
        
        whenever(passwordEntryService.saveOrUpdate(any(), any())).thenReturn(savedPasswordId)

        val requestType = SavePasswordRequestType(
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = Base64.encode("cipher".toByteArray()),
            saveType = type.PasswordSaveType.SAVE
        )
        val request = VaultRequestMessageDto(
            correlationId = correlationId,
            vaultId = vaultId,
            payload = requestType
        )

        handler.handleFrame(StompHeaders(), request)

        verify(passwordEntryService, times(1)).saveOrUpdate(eq(requestType), any())

        val ackCaptor = argumentCaptor<VaultResponseMessageDto<*>>()
        verify(stompSessionRegistry, times(1)).send(eq(StompEndpoints.USER_PASSWORD_SAVED), ackCaptor.capture())

        val ack = ackCaptor.firstValue
        assertEquals(VaultResponseStatus.OK, ack.status)
        assertEquals(correlationId, ack.messageId)
    }

    @Test
    fun `sends ERROR when repository save fails`() {
        whenever(passwordEntryService.saveOrUpdate(any(), any())).thenThrow(RuntimeException("db down"))

        val vaultId = UUID.randomUUID()
        val correlationId = UUID.randomUUID()

        val requestType = SavePasswordRequestType(
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = Base64.encode("cipher".toByteArray()),
            saveType = type.PasswordSaveType.SAVE
        )
        val request = VaultRequestMessageDto(
            correlationId = correlationId,
            vaultId = vaultId,
            payload = requestType
        )

        handler.handleFrame(StompHeaders(), request)

        val ackCaptor = argumentCaptor<VaultResponseMessageDto<*>>()
        verify(stompSessionRegistry, times(1)).send(eq(StompEndpoints.USER_PASSWORD_SAVED), ackCaptor.capture())

        val errorAck = ackCaptor.firstValue
        assertEquals(VaultResponseStatus.ERROR, errorAck.status)
        assertEquals(correlationId, errorAck.messageId)
    }

    @Test
    fun `ignores invalid payload type`() {
        handler.handleFrame(StompHeaders(), "invalid")

        verify(passwordEntryService, never()).saveOrUpdate(any(), any())
        verify(stompSessionRegistry, never()).send(any<String>(), any<Any>())
    }
}
