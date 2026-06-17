package pl.dayfit.mossyvault.service

import messaging.response.VaultResponseMessageDto
import messaging.response.type.VaultResponseType
import org.springframework.messaging.simp.stomp.StompSession
import org.springframework.stereotype.Component
import java.util.concurrent.atomic.AtomicReference

@Component
class StompSessionRegistry {
    private val sessionRef = AtomicReference<StompSession?>(null)

    fun setSession(session: StompSession) {
        sessionRef.set(session)
    }

    fun clearSession(session: StompSession?) {
        val current = sessionRef.get()
        if (current == null || current == session) {
            sessionRef.set(null)
        }
    }

    fun send(destination: String, payload: VaultResponseMessageDto<VaultResponseType>): Boolean {
        val session = sessionRef.get()
        if (session == null || !session.isConnected) {
            return false
        }

        session.send(destination, payload)
        return true
    }
}
