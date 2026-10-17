package pl.dayfit.mossykeysync.controller

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import pl.dayfit.mossykeysync.dto.request.InitKeySyncRequestDto
import pl.dayfit.mossykeysync.dto.request.UploadKeyDto
import pl.dayfit.mossykeysync.dto.response.InitKeySyncResponseDto
import pl.dayfit.mossykeysync.dto.response.VaultKeyResponseDto
import pl.dayfit.mossykeysync.service.KeySyncEventService
import pl.dayfit.mossykeysync.service.KeySyncService
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertSame

@ExtendWith(MockitoExtension::class)
class KeySyncControllerTest {
    @Mock
    lateinit var keySyncService: KeySyncService
    @Mock
    lateinit var keySyncEventService: KeySyncEventService

    @InjectMocks
    lateinit var controller: KeySyncController

    private val userId = UUID.fromString("20000000-0000-0000-0000-000000000001")
    private val deviceId = UUID.fromString("10000000-0000-0000-0000-000000000001")
    private val vaultId = UUID.fromString("30000000-0000-0000-0000-000000000001")

    @Test
    fun `init key sync uses the authenticated user and receiver device`() {
        val request = InitKeySyncRequestDto(
            vaultId,
            emptyMap(),
        )
        val serviceResponse = InitKeySyncResponseDto("123456")
        whenever(keySyncService.initKeySync(userId, deviceId, request.vaultId)).thenReturn(serviceResponse)

        val response = controller.initKeySync(jwtFor(userId, deviceId), request)

        assertEquals(HttpStatus.OK, response.statusCode)
        assertEquals(serviceResponse, response.body)
        verify(keySyncService).initKeySync(userId, deviceId, request.vaultId)
    }

    @Test
    fun `key upload uses the authenticated user and sender device with the requested code`() {
        val request = UploadKeyDto(vaultId, "encrypted-key", mapOf("x" to "sender-dh-key"))

        val response = controller.uploadKey(jwtFor(userId, deviceId), "ABC123", request)

        assertEquals(HttpStatus.OK, response.statusCode)
        verify(keySyncService).processKeyUpload(userId, deviceId, "ABC123", request)
    }

    @Test
    fun `vault keys are requested for the authenticated device`() {
        val senderId = UUID.fromString("10000000-0000-0000-0000-000000000002")
        val keys = listOf(VaultKeyResponseDto(vaultId, senderId, "encrypted-key"))
        whenever(keySyncService.getVaultKeys(deviceId)).thenReturn(keys)

        val response = controller.getVaultKeys(jwtFor(userId, deviceId))

        assertEquals(HttpStatus.OK, response.statusCode)
        assertEquals(keys, response.body)
        verify(keySyncService).getVaultKeys(deviceId)
    }

    @Test
    fun `receiver events are subscribed for the authenticated device`() {
        val emitter = SseEmitter()
        whenever(keySyncEventService.handleKeySyncEventSubscription(deviceId)).thenReturn(emitter)

        val response = controller.subscribeReceiverEvents(jwtFor(userId, deviceId))

        assertSame(emitter, response)
        verify(keySyncEventService).handleKeySyncEventSubscription(deviceId)
    }

    private fun jwtFor(userId: UUID, deviceId: UUID): Jwt = Jwt.withTokenValue("access-token")
        .header("alg", "RS256")
        .subject(userId.toString())
        .claim("device_id", deviceId.toString())
        .build()
}
