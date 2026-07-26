package pl.dayfit.mossydevice.service

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.springframework.web.socket.WebSocketSession
import pl.dayfit.mossydevice.model.redis.KeySyncRoom
import pl.dayfit.mossydevice.repository.redis.KeySyncRoomRepository
import pl.dayfit.mossydevice.type.KeySyncRole
import pl.dayfit.mossydevice.ws.dto.WebSocketMessageDto
import pl.dayfit.mossydevice.ws.dto.WebSocketServerMessageDto
import pl.dayfit.mossydevice.ws.principal.DevicePrincipal
import java.security.SecureRandom
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class KeySyncServiceTest {
    private val roomRepository: KeySyncRoomRepository = mock()
    private val sessionService: WebSocketSessionService = mock()
    private val notifier: WebSocketPeerNotifier = mock()
    private val secureRandom: SecureRandom = mock()
    private val service = KeySyncService(
        roomRepository,
        sessionService,
        notifier,
        secureRandom
    )

    @Test
    fun `first peer joins and waits without receiving peer details`() {
        val room = room().copy(
            receiverDh = null,
            receiverSignature = null,
            receiverPresent = false
        )
        val receiverSession = session()
        whenever(roomRepository.getKeySyncRoomsByUserId(USER_ID)).thenReturn(mutableListOf(room))

        service.handleDeviceJoinedSync(
            SYNC_CODE,
            DevicePrincipal(RECEIVER_ID, USER_ID, dhKey("receiver-dh")),
            "receiver-signature",
            receiverSession
        )

        assertTrue(room.receiverPresent)
        assertEquals("receiver-signature", room.receiverSignature)
        verify(roomRepository).save(room)
        verifyNoInteractions(notifier)
    }

    @Test
    fun `second peer joins and both peers receive unverified peer details`() {
        val room = room()
        val receiverSession = session()
        val senderSession = session()
        whenever(roomRepository.getKeySyncRoomsByUserId(USER_ID)).thenReturn(mutableListOf(room))
        whenever(sessionService.getSession(RECEIVER_ID)).thenReturn(receiverSession)
        whenever(sessionService.getSession(SENDER_ID)).thenReturn(senderSession)

        service.handleDeviceJoinedSync(
            SYNC_CODE,
            DevicePrincipal(SENDER_ID, USER_ID, dhKey("sender-dh")),
            "sender-signature",
            senderSession
        )

        assertTrue(room.senderPresent)
        assertEquals("sender-signature", room.senderSignature)
        verify(notifier).send(
            receiverSession,
            WebSocketServerMessageDto.PeerDetails(
                SENDER_ID,
                "sender-dh",
                "sender-signature",
                VAULT_ID
            )
        )
        verify(notifier).send(
            senderSession,
            WebSocketServerMessageDto.PeerDetails(
                RECEIVER_ID,
                "receiver-dh",
                "receiver-signature",
                VAULT_ID
            )
        )
    }

    @Test
    fun `rejected signature removes room and notifies both peers`() {
        val room = room(senderPresent = true)
        val receiverSession = session(KeySyncRole.RECEIVER)
        val senderSession = session(KeySyncRole.SENDER)
        whenever(roomRepository.getKeySyncRoomsByUserId(USER_ID)).thenReturn(mutableListOf(room))
        whenever(sessionService.getSession(RECEIVER_ID)).thenReturn(receiverSession)
        whenever(sessionService.getSession(SENDER_ID)).thenReturn(senderSession)

        service.handleSignatureStatus(
            WebSocketMessageDto.SignatureStatus(false),
            receiverSession
        )

        verify(roomRepository).delete(room)
        verify(notifier).send(receiverSession, WebSocketServerMessageDto.SignatureStatus(false))
        verify(notifier).send(senderSession, WebSocketServerMessageDto.SignatureStatus(false))
    }

    @Test
    fun `key sync remains blocked until both signatures are accepted`() {
        val room = room(senderPresent = true, receiverAccepted = true)
        val senderSession = session(KeySyncRole.SENDER)
        whenever(roomRepository.getKeySyncRoomsByUserId(USER_ID)).thenReturn(mutableListOf(room))
        val message = WebSocketMessageDto.KeySync("ciphertext", "nonce", "signature", VAULT_ID)

        assertThrows<IllegalStateException> {
            service.handleSync(message, senderSession)
        }

        verify(notifier, never()).send(any(), any())
    }

    @Test
    fun `both accepted signatures enable key sync and notify both peers`() {
        val room = room(senderPresent = true, receiverAccepted = true)
        val receiverSession = session(KeySyncRole.RECEIVER)
        val senderSession = session(KeySyncRole.SENDER)
        whenever(roomRepository.getKeySyncRoomsByUserId(USER_ID)).thenReturn(mutableListOf(room))
        whenever(sessionService.getSession(RECEIVER_ID)).thenReturn(receiverSession)
        whenever(sessionService.getSession(SENDER_ID)).thenReturn(senderSession)

        service.handleSignatureStatus(
            WebSocketMessageDto.SignatureStatus(true),
            senderSession
        )

        assertEquals(room.senderSignatureAccepted, true)
        verify(roomRepository).save(room)
        verify(notifier).send(receiverSession, WebSocketServerMessageDto.SignatureStatus(true))
        verify(notifier).send(senderSession, WebSocketServerMessageDto.SignatureStatus(true))

        val message = WebSocketMessageDto.KeySync("ciphertext", "nonce", "signature", VAULT_ID)
        service.handleSync(message, senderSession)
        verify(notifier).send(receiverSession, message)
    }

    private fun room(
        senderPresent: Boolean = false,
        receiverAccepted: Boolean? = null
    ) = KeySyncRoom(
        roomId = "room-id",
        code = SYNC_CODE,
        vaultId = VAULT_ID,
        userId = USER_ID,
        receiverId = RECEIVER_ID,
        receiverDh = "receiver-dh",
        receiverSignature = "receiver-signature",
        receiverPresent = true,
        receiverSignatureAccepted = receiverAccepted,
        senderId = if (senderPresent) SENDER_ID else null,
        senderDh = if (senderPresent) "sender-dh" else null,
        senderSignature = if (senderPresent) "sender-signature" else null,
        senderPresent = senderPresent
    )

    private fun session(role: KeySyncRole? = null): WebSocketSession = mock<WebSocketSession>().also {
        val attributes = mutableMapOf(
            "syncCode" to SYNC_CODE,
            "principal" to DevicePrincipal(
                if (role == KeySyncRole.RECEIVER) RECEIVER_ID else SENDER_ID,
                USER_ID,
                dhKey("session-dh")
            )
        )
        if (role != null) attributes["role"] = role
        whenever(it.attributes).thenReturn(attributes)
    }

    private fun dhKey(x: String): Map<String, Any> =
        mapOf("kty" to "OKP", "crv" to "X25519", "x" to x)

    private companion object {
        const val SYNC_CODE = "123456"
        val USER_ID: UUID = UUID.fromString("20000000-0000-0000-0000-000000000001")
        val RECEIVER_ID: UUID = UUID.fromString("10000000-0000-0000-0000-000000000001")
        val SENDER_ID: UUID = UUID.fromString("10000000-0000-0000-0000-000000000002")
        val VAULT_ID: UUID = UUID.fromString("30000000-0000-0000-0000-000000000001")
    }
}
