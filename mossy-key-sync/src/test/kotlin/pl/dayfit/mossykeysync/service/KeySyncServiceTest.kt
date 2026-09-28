package pl.dayfit.mossykeysync.service

import org.junit.jupiter.api.Test
import org.springframework.amqp.core.AnonymousQueue
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.web.socket.WebSocketSession
import pl.dayfit.mossykeysync.model.redis.KeySyncRoom
import pl.dayfit.mossykeysync.model.redis.KeySyncRoom.Peer
import pl.dayfit.mossykeysync.repository.redis.KeySyncRoomRepository
import pl.dayfit.mossykeysync.type.KeySyncRole
import pl.dayfit.mossykeysync.ws.dto.WebSocketMessageDto
import pl.dayfit.mossykeysync.ws.dto.WebSocketServerMessageDto
import pl.dayfit.mossykeysync.ws.principal.DevicePrincipal
import java.security.SecureRandom
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class KeySyncServiceTest {
    private val roomRepository: KeySyncRoomRepository = mock()
    private val sessionService: WebSocketSessionService = mock()
    private val replicaQueue: AnonymousQueue = mock()
    private val secureRandom: SecureRandom = mock()
    private val service = KeySyncService(
        roomRepository,
        sessionService,
        secureRandom,
        replicaQueue
    )

    init {
        whenever(replicaQueue.name).thenReturn(REPLICA_QUEUE)
    }

    @Test
    fun `first peer joins and waits without receiving peer details`() {
        val room = room().copy(
            receiver = Peer(id = RECEIVER_ID, location = REPLICA_QUEUE)
        )
        val receiverSession = session()
        whenever(roomRepository.getKeySyncRoomsByUserId(USER_ID)).thenReturn(mutableListOf(room))

        service.handleDeviceJoinedSync(
            SYNC_CODE,
            DevicePrincipal(RECEIVER_ID, USER_ID, dhKey("receiver-dh")),
            "receiver-signature",
            receiverSession
        )

        assertTrue(room.receiver.isPresent)
        assertEquals("receiver-signature", room.receiver.signature)
        verify(roomRepository).save(room)
        verify(sessionService, never()).send(any<WebSocketSession>(), any<Any>())
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

        assertEquals(true, room.sender?.isPresent)
        assertEquals("sender-signature", room.sender?.signature)
        verify(sessionService).send(
            receiverSession,
            WebSocketServerMessageDto.PeerDetails(
                SENDER_ID,
                "sender-dh",
                "sender-signature",
                VAULT_ID
            )
        )
        verify(sessionService).send(
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
        verify(sessionService).send(receiverSession, WebSocketServerMessageDto.SignatureStatus(false))
        verify(sessionService).send(senderSession, WebSocketServerMessageDto.SignatureStatus(false))
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

        verify(sessionService, never()).send(any<WebSocketSession>(), any<Any>())
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

        assertEquals(true, room.sender?.signatureAccepted)
        verify(roomRepository).save(room)
        verify(sessionService).send(receiverSession, WebSocketServerMessageDto.SignatureStatus(true))
        verify(sessionService).send(senderSession, WebSocketServerMessageDto.SignatureStatus(true))

        val message = WebSocketMessageDto.KeySync("ciphertext", "nonce", "signature", VAULT_ID)
        service.handleSync(message, senderSession)
        verify(sessionService).send(receiverSession, message)
    }

    @Test
    fun `initial room contains an absent receiver and no sender`() {
        whenever(secureRandom.nextInt(1, 1_000_000)).thenReturn(123456)

        val response = service.initKeySync(USER_ID, RECEIVER_ID, VAULT_ID)

        val captor = argumentCaptor<KeySyncRoom>()
        verify(roomRepository).save(captor.capture())
        assertEquals(Peer(id = RECEIVER_ID, location = REPLICA_QUEUE), captor.firstValue.receiver)
        assertNull(captor.firstValue.sender)
        assertEquals(SYNC_CODE, captor.firstValue.code)
        assertEquals(SYNC_CODE, response.code)
    }

    @Test
    fun `receiver disconnect clears handshake data and allows rejoin`() {
        val room = room(receiverAccepted = true)
        whenever(roomRepository.getKeySyncRoomsByUserId(USER_ID)).thenReturn(mutableListOf(room))

        service.handlePeerDisconnected(session(KeySyncRole.RECEIVER))

        assertEquals(Peer(id = RECEIVER_ID, location = REPLICA_QUEUE), room.receiver)
        verify(roomRepository).save(room)

        service.handleDeviceJoinedSync(
            SYNC_CODE,
            DevicePrincipal(RECEIVER_ID, USER_ID, dhKey("new-dh")),
            "new-signature",
            session(KeySyncRole.RECEIVER)
        )

        assertEquals(Peer(RECEIVER_ID, REPLICA_QUEUE, "new-dh", "new-signature", true), room.receiver)
    }

    @Test
    fun `sender disconnect removes peer and rejoin starts with unaccepted signature`() {
        val room = room(senderPresent = true)
        room.sender!!.signatureAccepted = true
        val receiverBefore = room.receiver.copy()
        whenever(roomRepository.getKeySyncRoomsByUserId(USER_ID)).thenReturn(mutableListOf(room))

        service.handlePeerDisconnected(session(KeySyncRole.SENDER))

        assertNull(room.sender)
        assertEquals(receiverBefore, room.receiver)
        verify(roomRepository).save(room)

        service.handleDeviceJoinedSync(
            SYNC_CODE,
            DevicePrincipal(SENDER_ID, USER_ID, dhKey("new-dh")),
            "new-signature",
            session(KeySyncRole.SENDER)
        )

        assertEquals(Peer(SENDER_ID, REPLICA_QUEUE, "new-dh", "new-signature", true), room.sender)
    }

    @Test
    fun `absent sender cannot accept signature`() {
        whenever(roomRepository.getKeySyncRoomsByUserId(USER_ID)).thenReturn(mutableListOf(room()))

        assertThrows<IllegalStateException> {
            service.handleSignatureStatus(WebSocketMessageDto.SignatureStatus(true), session(KeySyncRole.SENDER))
        }

        verify(roomRepository, never()).save(any())
        verify(sessionService, never()).send(any<WebSocketSession>(), any<Any>())
    }

    private fun room(
        senderPresent: Boolean = false,
        receiverAccepted: Boolean? = null
    ) = KeySyncRoom(
        roomId = "room-id",
        code = SYNC_CODE,
        vaultId = VAULT_ID,
        userId = USER_ID,
        receiver = Peer(
            id = RECEIVER_ID,
            location = REPLICA_QUEUE,
            diffieHellmanPk = "receiver-dh",
            signature = "receiver-signature",
            isPresent = true,
            signatureAccepted = receiverAccepted
        ),
        sender = if (senderPresent) Peer(
            id = SENDER_ID,
            location = REPLICA_QUEUE,
            diffieHellmanPk = "sender-dh",
            signature = "sender-signature",
            isPresent = true
        ) else null
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
        const val REPLICA_QUEUE = "replica.queue"
        val USER_ID: UUID = UUID.fromString("20000000-0000-0000-0000-000000000001")
        val RECEIVER_ID: UUID = UUID.fromString("10000000-0000-0000-0000-000000000001")
        val SENDER_ID: UUID = UUID.fromString("10000000-0000-0000-0000-000000000002")
        val VAULT_ID: UUID = UUID.fromString("30000000-0000-0000-0000-000000000001")
    }
}
