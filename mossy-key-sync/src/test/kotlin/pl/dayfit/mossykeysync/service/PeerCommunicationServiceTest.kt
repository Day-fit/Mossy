package pl.dayfit.mossykeysync.service

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.isA
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.amqp.rabbit.AsyncRabbitTemplate
import org.springframework.amqp.rabbit.RabbitConverterFuture
import pl.dayfit.mossykeysync.dto.messaging.PeerRequestMessage
import pl.dayfit.mossykeysync.dto.messaging.PeerResponseMessage
import pl.dayfit.mossykeysync.model.redis.KeySyncRoom
import pl.dayfit.mossykeysync.model.redis.KeySyncRoom.Peer
import pl.dayfit.mossykeysync.repository.redis.KeySyncRoomRepository
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals

class PeerCommunicationServiceTest {
    private val rabbitTemplate: AsyncRabbitTemplate = mock()
    private val roomRepository: KeySyncRoomRepository = mock()
    private val sessionService: WebSocketSessionService = mock()
    private val responseFuture: RabbitConverterFuture<PeerResponseMessage> = mock()
    private val service = PeerCommunicationService(rabbitTemplate, roomRepository, sessionService)

    @Test
    fun `send message uses the receiver replica queue`() {
        val request = PeerRequestMessage(RECEIVER_ID, "payload")
        whenever(roomRepository.findById(ROOM_ID)).thenReturn(Optional.of(room()))
        whenever(rabbitTemplate.convertSendAndReceive<PeerResponseMessage>(any<String>(), any<String>(), any<Any>()))
            .thenReturn(responseFuture)

        service.sendMessage(ROOM_ID, RECEIVER_ID, request)

        verify(rabbitTemplate).convertSendAndReceive<PeerResponseMessage>(
            any<String>(), eq("receiver.queue"), eq(request)
        )
    }

    @Test
    fun `send message uses generic class wrapper`() {
        val request = PeerRequestMessage(RECEIVER_ID, "payload")

        whenever(roomRepository.findById(ROOM_ID)).thenReturn(Optional.of(room()))
        whenever(rabbitTemplate.convertSendAndReceive<PeerResponseMessage>(any<String>(), any<String>(), any<Any>()))
            .thenReturn(responseFuture)

        service.sendMessage(ROOM_ID, RECEIVER_ID, request)

        verify(rabbitTemplate).convertSendAndReceive<PeerResponseMessage>(
            any<String>(), eq("receiver.queue"), isA<PeerRequestMessage<Any>>()
        )
    }

    @Test
    fun `send message uses the sender replica queue`() {
        val request = PeerRequestMessage(SENDER_ID, "payload")
        whenever(roomRepository.findById(ROOM_ID)).thenReturn(Optional.of(room()))
        whenever(rabbitTemplate.convertSendAndReceive<PeerResponseMessage>(any<String>(), any<String>(), any<Any>()))
            .thenReturn(responseFuture)

        service.sendMessage(ROOM_ID, SENDER_ID, request)

        verify(rabbitTemplate).convertSendAndReceive<PeerResponseMessage>(
            any<String>(), eq("sender.queue"), eq(request)
        )
    }

    @Test
    fun `received request forwards payload and acknowledges success`() {
        val response = service.receiveMessage(PeerRequestMessage(RECEIVER_ID, "payload"))

        verify(sessionService).send(RECEIVER_ID, "payload")
        assertEquals(PeerResponseMessage.Status.SUCCESS, response.status)
    }

    @Test
    fun `failed websocket send returns failed acknowledgement`() {
        whenever(sessionService.send(RECEIVER_ID, "payload")).thenThrow(NoSuchElementException())

        val response = service.receiveMessage(PeerRequestMessage(RECEIVER_ID, "payload"))

        assertEquals(PeerResponseMessage.Status.FAILED, response.status)
    }

    private fun room() = KeySyncRoom(
        roomId = ROOM_ID,
        code = "123456",
        vaultId = UUID.fromString("30000000-0000-0000-0000-000000000001"),
        userId = UUID.fromString("20000000-0000-0000-0000-000000000001"),
        receiver = Peer(RECEIVER_ID, "receiver.queue"),
        sender = Peer(SENDER_ID, "sender.queue")
    )

    private companion object {
        const val ROOM_ID = "room-id"
        val RECEIVER_ID: UUID = UUID.fromString("10000000-0000-0000-0000-000000000001")
        val SENDER_ID: UUID = UUID.fromString("10000000-0000-0000-0000-000000000002")
    }
}
