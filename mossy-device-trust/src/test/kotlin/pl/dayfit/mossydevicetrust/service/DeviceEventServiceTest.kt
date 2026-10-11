package pl.dayfit.mossydevicetrust.service

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.clearInvocations
import org.mockito.Mockito.mock
import org.mockito.Mockito.mockConstruction
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.inOrder
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.verifyNoMoreInteractions
import org.mockito.kotlin.whenever
import org.springframework.amqp.core.FanoutExchange
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.http.MediaType
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import pl.dayfit.mossydevicetrust.dto.response.DeviceEnrollmentsResponseDto
import pl.dayfit.mossydevicetrust.messaging.DeviceEnrolledEvent
import java.time.Instant
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class DeviceEventServiceTest {
    private val rabbitTemplate: RabbitTemplate = mock()
    private val fanoutExchange: FanoutExchange = mock()
    private val exchangeName = "test.device-enrollment-events.fanout"

    private val deviceEventService = DeviceEventService(fanoutExchange, rabbitTemplate)

    @Test
    fun `Device enrolled event sends message with rabbitmq`() {
        whenever(fanoutExchange.name).thenReturn(exchangeName)
        val userId = UUID.fromString("9570cd68-05ac-4be4-beda-6c21f45da6ca")
        val enrollmentId = UUID.fromString("ea090008-08a7-4120-8bc1-d5336d741824")
        val createdAt = Instant.parse("2024-08-15T14:51:30.661Z")

        val newEnrollment = DeviceEnrollmentsResponseDto.DeviceEnrollmentDto(
            enrollmentId,
            "Windows NT",
            "Desktop",
            "27.196.136.239",
            createdAt,
        )

        val event = DeviceEnrolledEvent(
            userId,
            newEnrollment
        )

        deviceEventService.handleDeviceEnrolledEvent(
            event
        )

        verify(rabbitTemplate).convertAndSend(exchangeName, "", event)
    }

    @Test
    fun `received enrollment is sent to the subscribed user as JSON`() {
        val event = enrollmentEvent(UUID.randomUUID())

        mockConstruction(SseEmitter::class.java).use {
            val emitter = deviceEventService.subscribeNewEnrollmentEvent(event.userId)

            deviceEventService.handleDeviceEnrollmentEvent(event)

            verify(emitter).send(event.newEnrollment, MediaType.APPLICATION_JSON)
            verifyNoInteractions(rabbitTemplate)
        }
    }

    @Test
    fun `received enrollment is sent to every subscription for its user`() {
        val event = enrollmentEvent(UUID.randomUUID())

        mockConstruction(SseEmitter::class.java).use {
            val firstEmitter = deviceEventService.subscribeNewEnrollmentEvent(event.userId)
            val secondEmitter = deviceEventService.subscribeNewEnrollmentEvent(event.userId)

            deviceEventService.handleDeviceEnrollmentEvent(event)

            verify(firstEmitter).send(event.newEnrollment, MediaType.APPLICATION_JSON)
            verify(secondEmitter).send(event.newEnrollment, MediaType.APPLICATION_JSON)
            verifyNoInteractions(rabbitTemplate)
        }
    }

    @Test
    fun `received enrollments are isolated between users`() {
        val firstEvent = enrollmentEvent(UUID.randomUUID())
        val secondEvent = enrollmentEvent(UUID.randomUUID())

        mockConstruction(SseEmitter::class.java).use {
            val firstEmitter = deviceEventService.subscribeNewEnrollmentEvent(firstEvent.userId)
            val secondEmitter = deviceEventService.subscribeNewEnrollmentEvent(secondEvent.userId)
            // Ignore registration callbacks so only event delivery is verified below.
            clearInvocations(firstEmitter, secondEmitter)

            deviceEventService.handleDeviceEnrollmentEvent(firstEvent)
            verify(firstEmitter).send(firstEvent.newEnrollment, MediaType.APPLICATION_JSON)
            verifyNoInteractions(secondEmitter)

            deviceEventService.handleDeviceEnrollmentEvent(secondEvent)
            verify(secondEmitter).send(secondEvent.newEnrollment, MediaType.APPLICATION_JSON)
            verifyNoMoreInteractions(firstEmitter, secondEmitter)
        }
    }

    @Test
    fun `received enrollment with no subscribers does not republish to RabbitMQ`() {
        deviceEventService.handleDeviceEnrollmentEvent(enrollmentEvent(UUID.randomUUID()))

        verifyNoInteractions(rabbitTemplate)
    }

    @Test
    fun `subscription receives subsequent events in order without replaying earlier events`() {
        val userId = UUID.randomUUID()
        val earlierEvent = enrollmentEvent(userId)
        val firstEvent = enrollmentEvent(userId)
        val secondEvent = enrollmentEvent(userId)
        deviceEventService.handleDeviceEnrollmentEvent(earlierEvent)

        mockConstruction(SseEmitter::class.java).use {
            val emitter = deviceEventService.subscribeNewEnrollmentEvent(userId)
            clearInvocations(emitter)

            deviceEventService.handleDeviceEnrollmentEvent(firstEvent)
            deviceEventService.handleDeviceEnrollmentEvent(secondEvent)

            inOrder(emitter) {
                verify(emitter).send(firstEvent.newEnrollment, MediaType.APPLICATION_JSON)
                verify(emitter).send(secondEvent.newEnrollment, MediaType.APPLICATION_JSON)
            }
            verifyNoMoreInteractions(emitter)
        }
    }

    @Test
    fun `publishing an enrollment does not deliver it before RabbitMQ consumption`() {
        whenever(fanoutExchange.name).thenReturn(exchangeName)
        val event = enrollmentEvent(UUID.randomUUID())

        mockConstruction(SseEmitter::class.java).use {
            val emitter = deviceEventService.subscribeNewEnrollmentEvent(event.userId)
            clearInvocations(emitter)

            deviceEventService.handleDeviceEnrolledEvent(event)

            verify(rabbitTemplate).convertAndSend(exchangeName, "", event)
            verifyNoInteractions(emitter)
        }
    }

    private fun enrollmentEvent(userId: UUID) = DeviceEnrolledEvent(
        userId,
        DeviceEnrollmentsResponseDto.DeviceEnrollmentDto(
            UUID.randomUUID(),
            "Windows NT",
            "Desktop",
            "192.0.2.10",
            Instant.parse("2024-08-15T14:51:30.661Z"),
        ),
    )
}
