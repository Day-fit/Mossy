package pl.dayfit.mossykeysync.service

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Answers
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.Spy
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.security.access.AccessDeniedException
import pl.dayfit.mossykeysync.dto.request.InitKeySyncRequestDto
import pl.dayfit.mossykeysync.dto.request.UploadKeyDto
import pl.dayfit.mossykeysync.dto.response.PendingReceiverResponseDto
import pl.dayfit.mossykeysync.dto.response.VaultKeyResponseDto
import pl.dayfit.mossykeysync.event.KeySyncEvent
import pl.dayfit.mossykeysync.exception.InvalidKeyUploadedException
import pl.dayfit.mossykeysync.model.redis.KeySyncInfo
import pl.dayfit.mossykeysync.model.redis.VaultKey
import pl.dayfit.mossykeysync.repository.redis.VaultKeyRepository
import java.security.SecureRandom
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

@ExtendWith(MockitoExtension::class)
class KeySyncServiceTest {
    @Mock
    lateinit var vaultKeyRepository: VaultKeyRepository
    @Mock
    lateinit var applicationEventPublisher: ApplicationEventPublisher
    @Spy
    lateinit var secureRandom: SecureRandom
    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    lateinit var redisTemplate: RedisTemplate<String, KeySyncInfo>

    @InjectMocks
    lateinit var service: KeySyncService

    @Test
    fun `init key sync returns a six character code and saves receiver info under the user and code`() {
        val response = service.initKeySync(
            USER_ID,
            RECEIVER_ID,
            InitKeySyncRequestDto(VAULT_ID, RECEIVER_PUBLIC_DH, RECEIVER_SIGNATURE),
        )

        val codeCaptor = argumentCaptor<String>()
        val infoCaptor = argumentCaptor<KeySyncInfo>()

        verify(secureRandom).nextBytes(any())
        verify(redisTemplate.opsForValue()).set(codeCaptor.capture(), infoCaptor.capture())

        val saved = infoCaptor.firstValue

        assertEquals("$USER_ID:${response.code}", codeCaptor.firstValue)
        assertEquals(USER_ID, saved.userId)
        assertEquals(RECEIVER_ID, saved.receiverId)
        assertEquals(VAULT_ID, saved.vaultId)
        assertEquals(RECEIVER_PUBLIC_DH, saved.publicDh)
        assertEquals(RECEIVER_SIGNATURE, saved.signature)
        verify(redisTemplate.opsForHash<String, KeySyncInfo>())
            .put("$USER_ID:pending-key-sync", response.code, saved)
        assertEquals(6, response.code.length)
        assertTrue(response.code.all { it in "0123456789ABCDEFGHJKMNPQRSTVWXYZ" })
    }

    @Test
    fun `key upload consumes the user code, saves the key for the receiver, and publishes success`() {
        val request = uploadRequest()
        whenever(redisTemplate.opsForValue().getAndDelete("$USER_ID:$SYNC_CODE"))
            .thenReturn(KeySyncInfo(USER_ID, VAULT_ID, RECEIVER_ID, RECEIVER_PUBLIC_DH, RECEIVER_SIGNATURE))

        service.processKeyUpload(USER_ID, SENDER_ID, SYNC_CODE, request)

        val keyCaptor = argumentCaptor<VaultKey>()
        verify(redisTemplate.opsForValue()).getAndDelete("$USER_ID:$SYNC_CODE")
        verify(redisTemplate.opsForHash<String, KeySyncInfo>()).delete("$USER_ID:pending-key-sync", SYNC_CODE)
        verify(vaultKeyRepository).save(keyCaptor.capture())

        val saved = keyCaptor.firstValue
        assertEquals(RECEIVER_ID, saved.receiverId)
        assertEquals(VAULT_ID, saved.vaultId)
        assertEquals(SENDER_ID, saved.senderId)
        assertEquals(request.ciphertext, saved.cipherText)
        assertEquals(request.publicDh["x"], saved.senderPublicDh)
        assertEquals(SYNC_CODE, saved.code)
        verify(applicationEventPublisher).publishEvent(KeySyncEvent(RECEIVER_ID, KeySyncEvent.Result.SUCCESS))
    }

    @Test
    fun `key upload with an unknown code does not save a key or publish an event`() {
        whenever(redisTemplate.opsForValue().getAndDelete("$USER_ID:$SYNC_CODE")).thenReturn(null)

        assertThrows<NoSuchElementException> {
            service.processKeyUpload(USER_ID, SENDER_ID, SYNC_CODE, uploadRequest())
        }

        verify(redisTemplate.opsForValue()).getAndDelete("$USER_ID:$SYNC_CODE")
        verifyNoInteractions(vaultKeyRepository, applicationEventPublisher)
    }

    @Test
    fun `key upload for a different user is denied and notifies the receiver of failure`() {
        val otherUserId = UUID.fromString("7985807b-8385-40e8-9f58-7945aece4cb6")
        whenever(redisTemplate.opsForValue().getAndDelete("$USER_ID:$SYNC_CODE"))
            .thenReturn(KeySyncInfo(otherUserId, VAULT_ID, RECEIVER_ID, RECEIVER_PUBLIC_DH, RECEIVER_SIGNATURE))

        assertThrows<AccessDeniedException> {
            service.processKeyUpload(USER_ID, SENDER_ID, SYNC_CODE, uploadRequest())
        }

        val eventCaptor = argumentCaptor<KeySyncEvent>()
        verify(applicationEventPublisher).publishEvent(eventCaptor.capture())
        assertEquals(RECEIVER_ID, eventCaptor.firstValue.receiverId)
        assertEquals(KeySyncEvent.Result.FAILED, eventCaptor.firstValue.result)
        assertIs<IllegalStateException>(eventCaptor.firstValue.throwable)
        verifyNoInteractions(vaultKeyRepository)
    }

    @Test
    fun `key upload for a different vault is rejected and notifies the receiver of failure`() {
        val otherVaultId = UUID.fromString("c2c13869-d6e0-4e25-9483-2ac0a7931bfa")
        whenever(redisTemplate.opsForValue().getAndDelete("$USER_ID:$SYNC_CODE"))
            .thenReturn(KeySyncInfo(USER_ID, VAULT_ID, RECEIVER_ID, RECEIVER_PUBLIC_DH, RECEIVER_SIGNATURE))

        assertThrows<InvalidKeyUploadedException> {
            service.processKeyUpload(USER_ID, SENDER_ID, SYNC_CODE, uploadRequest().copy(vaultId = otherVaultId))
        }

        val eventCaptor = argumentCaptor<KeySyncEvent>()
        verify(applicationEventPublisher).publishEvent(eventCaptor.capture())
        assertEquals(RECEIVER_ID, eventCaptor.firstValue.receiverId)
        assertEquals(KeySyncEvent.Result.FAILED, eventCaptor.firstValue.result)
        assertIs<IllegalStateException>(eventCaptor.firstValue.throwable)
        verifyNoInteractions(vaultKeyRepository)
    }

    @Test
    fun `key upload without a DH public key does not save a key or publish success`() {
        whenever(redisTemplate.opsForValue().getAndDelete("$USER_ID:$SYNC_CODE"))
            .thenReturn(KeySyncInfo(USER_ID, VAULT_ID, RECEIVER_ID, RECEIVER_PUBLIC_DH, RECEIVER_SIGNATURE))

        assertThrows<IllegalArgumentException> {
            service.processKeyUpload(
                USER_ID,
                SENDER_ID,
                SYNC_CODE,
                uploadRequest().copy(publicDh = emptyMap()),
            )
        }

        verifyNoInteractions(vaultKeyRepository, applicationEventPublisher)
    }

    @Test
    fun `failed key persistence does not publish a success event`() {
        whenever(redisTemplate.opsForValue().getAndDelete("$USER_ID:$SYNC_CODE"))
            .thenReturn(KeySyncInfo(USER_ID, VAULT_ID, RECEIVER_ID, RECEIVER_PUBLIC_DH, RECEIVER_SIGNATURE))
        whenever(vaultKeyRepository.save(any<VaultKey>())).thenThrow(IllegalStateException("Redis unavailable"))

        assertThrows<IllegalStateException> {
            service.processKeyUpload(USER_ID, SENDER_ID, SYNC_CODE, uploadRequest())
        }

        verifyNoInteractions(applicationEventPublisher)
    }

    @Test
    fun `vault keys are retrieved for the requesting device and include the sender and ciphertext`() {
        val otherVaultId = UUID.fromString("c2c13869-d6e0-4e25-9483-2ac0a7931bfa")
        val otherSenderId = UUID.fromString("bc4881b7-a4d2-49df-824f-dda2428333f2")
        whenever(vaultKeyRepository.findAllByReceiverId(RECEIVER_ID)).thenReturn(mutableListOf(
            VaultKey(RECEIVER_ID, VAULT_ID, "first-ciphertext", SENDER_ID, "first-dh-key", SYNC_CODE),
            VaultKey(RECEIVER_ID, otherVaultId, "second-ciphertext", otherSenderId, "second-dh-key", "DEF456"),
        ))

        val response = service.getVaultKeys(RECEIVER_ID)

        assertEquals(listOf(
            VaultKeyResponseDto(VAULT_ID, SENDER_ID, "first-ciphertext", "first-dh-key", SYNC_CODE),
            VaultKeyResponseDto(otherVaultId, otherSenderId, "second-ciphertext", "second-dh-key", "DEF456"),
        ), response.keys)
        verify(vaultKeyRepository).findAllByReceiverId(RECEIVER_ID)
    }

    private fun uploadRequest() = UploadKeyDto(
        VAULT_ID,
        "encrypted-vault-key",
        mapOf("kty" to "OKP", "crv" to "X25519", "x" to "sender-dh-key"),
    )

    @Test
    fun `pending receivers include only requests belonging to the authenticated user`() {
        val otherReceiverId = UUID.fromString("bc4881b7-a4d2-49df-824f-dda2428333f2")
        val otherUserId = UUID.fromString("7985807b-8385-40e8-9f58-7945aece4cb6")
        val first = KeySyncInfo(USER_ID, VAULT_ID, RECEIVER_ID, RECEIVER_PUBLIC_DH, RECEIVER_SIGNATURE)
        val second = first.copy(receiverId = otherReceiverId)
        whenever(redisTemplate.opsForHash<String, KeySyncInfo>().entries("$USER_ID:pending-key-sync"))
            .thenReturn(mapOf(SYNC_CODE to first, "DEF456" to second, "FOREIGN" to first.copy(userId = otherUserId)))

        val response = service.getPendingReceivers(USER_ID)

        assertEquals(listOf(
            PendingReceiverResponseDto(SYNC_CODE, RECEIVER_ID, VAULT_ID, RECEIVER_PUBLIC_DH, RECEIVER_SIGNATURE),
            PendingReceiverResponseDto("DEF456", otherReceiverId, VAULT_ID, RECEIVER_PUBLIC_DH, RECEIVER_SIGNATURE),
        ), response)
        verify(redisTemplate.opsForHash<String, KeySyncInfo>()).entries("$USER_ID:pending-key-sync")
        verifyNoInteractions(vaultKeyRepository)
    }

    private companion object {
        const val SYNC_CODE = "ABC123"
        const val RECEIVER_SIGNATURE = "receiver-signature"
        val RECEIVER_PUBLIC_DH: Map<String, Any> = mapOf("kty" to "OKP", "crv" to "X25519", "x" to "receiver-dh-key")
        val USER_ID: UUID = UUID.fromString("7985807b-8385-40e8-9f58-7945aece4cb5")
        val RECEIVER_ID: UUID = UUID.fromString("bc4881b7-a4d2-49df-824f-dda2428333f0")
        val SENDER_ID: UUID = UUID.fromString("bc4881b7-a4d2-49df-824f-dda2428333f1")
        val VAULT_ID: UUID = UUID.fromString("c2c13869-d6e0-4e25-9483-2ac0a7931bf9")
    }
}
