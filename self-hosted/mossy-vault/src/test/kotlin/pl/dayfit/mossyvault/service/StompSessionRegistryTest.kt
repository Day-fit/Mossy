package pl.dayfit.mossyvault.service

import messaging.response.VaultResponseMessageDto
import messaging.response.type.AssignTagResponseType
import messaging.response.type.VaultResponseType
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.messaging.simp.stomp.StompSession
import type.VaultResponseStatus
import java.util.UUID
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class StompSessionRegistryTest {

    private val registry = StompSessionRegistry()

    private fun payload(): VaultResponseMessageDto<VaultResponseType> = VaultResponseMessageDto(
        messageId = UUID.randomUUID(),
        payload = AssignTagResponseType(),
        status = VaultResponseStatus.OK
    )

    @Test
    fun `send returns false when no session`() {
        val sent = registry.send("/app/test", payload())

        assertFalse(sent)
    }

    @Test
    fun `send uses connected session`() {
        val session: StompSession = mock()
        whenever(session.isConnected).thenReturn(true)

        registry.setSession(session)

        val sent = registry.send("/app/test", payload())

        assertTrue(sent)
        verify(session).send(eq("/app/test"), any<VaultResponseMessageDto<VaultResponseType>>())
    }

    @Test
    fun `send returns false when session is disconnected`() {
        val session: StompSession = mock()
        whenever(session.isConnected).thenReturn(false)

        registry.setSession(session)

        val sent = registry.send("/app/test", payload())

        assertFalse(sent)
        verify(session, never()).send(any<String>(), any<VaultResponseMessageDto<VaultResponseType>>())
    }

    @Test
    fun `clear session only clears matching session`() {
        val first: StompSession = mock()
        val second: StompSession = mock()
        whenever(first.isConnected).thenReturn(true)

        registry.setSession(first)
        registry.clearSession(second)

        val sent = registry.send("/app/test", payload())

        assertTrue(sent)
        verify(first).send(eq("/app/test"), any<VaultResponseMessageDto<VaultResponseType>>())
    }
}
