package pl.dayfit.mossyvault.service

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.messaging.simp.stomp.StompSession
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class StompSessionRegistryTest {

    private val registry = StompSessionRegistry()

    @Test
    fun `send returns false when no session`() {
        val sent = registry.send("/app/test", "payload")

        assertFalse(sent)
    }

    @Test
    fun `send uses connected session`() {
        val session: StompSession = mock()
        whenever(session.isConnected).thenReturn(true)

        registry.setSession(session)

        val sent = registry.send("/app/test", "payload")

        assertTrue(sent)
        verify(session).send(eq("/app/test"), eq("payload"))
    }

    @Test
    fun `send returns false when session is disconnected`() {
        val session: StompSession = mock()
        whenever(session.isConnected).thenReturn(false)

        registry.setSession(session)

        val sent = registry.send("/app/test", "payload")

        assertFalse(sent)
        verify(session, never()).send(any<String>(), any<Any>())
    }

    @Test
    fun `clear session only clears matching session`() {
        val first: StompSession = mock()
        val second: StompSession = mock()
        whenever(first.isConnected).thenReturn(true)

        registry.setSession(first)
        registry.clearSession(second)

        val sent = registry.send("/app/test", "payload")

        assertTrue(sent)
        verify(first).send(eq("/app/test"), eq("payload"))
    }
}
