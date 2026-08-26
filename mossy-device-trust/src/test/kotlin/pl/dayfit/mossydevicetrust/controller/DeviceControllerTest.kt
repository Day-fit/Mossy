package pl.dayfit.mossydevicetrust.controller

import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.gen.OctetKeyPairGenerator
import org.mockito.kotlin.any
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.ValueOperations
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.http.MediaType
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.authentication.LockedException
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.RequestPostProcessor
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import pl.dayfit.mossydevicetrust.exception.SelfLockNotAllowedException
import pl.dayfit.mossydevicetrust.helper.KeygenHelper.generateKeyPair
import pl.dayfit.mossydevicetrust.dto.request.ConfirmDeviceEnrollmentRequestDto
import pl.dayfit.mossydevicetrust.dto.request.CreateDeviceEnrollmentRequestDto
import pl.dayfit.mossydevicetrust.dto.response.CreateDeviceEnrollmentResponseDto
import pl.dayfit.mossydevicetrust.dto.response.DeviceEnrollmentsResponseDto
import pl.dayfit.mossydevicetrust.dto.response.DevicesResponseDto
import pl.dayfit.mossydevicetrust.model.redis.IdempotencyKey
import pl.dayfit.mossydevicetrust.repository.redis.IdempotencyKeyRepository
import pl.dayfit.mossydevicetrust.service.DeviceInfoService
import pl.dayfit.mossydevicetrust.service.IdempotencyService
import pl.dayfit.mossydevicetrustshared.dto.request.RegisterDeviceRequestDto
import pl.dayfit.mossydevicetrustshared.dto.response.GenerateChallengeResponseDto
import tools.jackson.module.kotlin.jsonMapper
import java.time.Duration
import java.time.Instant
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import kotlin.test.Test
import kotlin.test.assertIs

@WebMvcTest(DeviceController::class)
@AutoConfigureMockMvc(addFilters = false)
@Import(IdempotencyService::class)
class DeviceControllerTest(
    @Autowired val mockMvc: MockMvc,
) {
    @MockitoBean
    private lateinit var deviceInfoService: DeviceInfoService

    @MockitoBean
    private lateinit var idempotencyKeyRepository: IdempotencyKeyRepository

    @MockitoBean
    private lateinit var redisTemplate: RedisTemplate<UUID, Boolean>

    private val idempotencyValueOperations: ValueOperations<UUID, Boolean> = mock()
    private val idempotencyProgress = ConcurrentHashMap<UUID, Boolean>()

    @org.junit.jupiter.api.BeforeEach
    fun configureIdempotencyClaims() {
        idempotencyProgress.clear()
        whenever(redisTemplate.opsForValue()).thenReturn(idempotencyValueOperations)
        whenever(idempotencyValueOperations.setIfAbsent(any(), eq(true), eq(Duration.ofSeconds(30))))
            .thenAnswer { invocation ->
                idempotencyProgress.putIfAbsent(invocation.getArgument(0), true) == null
            }
    }

    private val jsonMapper = jsonMapper { }

    @Test
    fun `get devices returns account devices and identifies current device`() {
        val deviceId = UUID.randomUUID()
        val userId = UUID.randomUUID()
        whenever(deviceInfoService.getDevices(userId, deviceId)).thenReturn(
            DevicesResponseDto(
                listOf(
                    DevicesResponseDto.DeviceDto(
                        id = deviceId,
                        lastOsName = "Linux",
                        deviceType = "Desktop",
                        lastSeen = Instant.parse("2026-08-11T12:00:00Z"),
                        blocked = false,
                        current = true,
                    )
                )
            )
        )

        mockMvc.perform(get("/devices").with(jwtPrincipal(deviceId, userId)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.devices[0].id").value(deviceId.toString()))
            .andExpect(jsonPath("$.devices[0].current").value(true))

        verify(deviceInfoService).getDevices(userId, deviceId)
    }

    @Test
    fun `unblock device delegates current and target identifiers`() {
        val deviceId = UUID.randomUUID()
        val targetDeviceId = UUID.randomUUID()

        mockMvc.perform(
            post("/device/unblock")
                .with(jwtPrincipal(deviceId))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"targetDeviceId":"$targetDeviceId"}""")
        ).andExpect(status().isOk)

        verify(deviceInfoService).setDeviceBlocked(deviceId, targetDeviceId, false)
    }

    @Test
    fun `get enrollments returns pending requests for authenticated user`() {
        val deviceId = UUID.randomUUID()
        val userId = UUID.randomUUID()
        val enrollment = DeviceEnrollmentsResponseDto.DeviceEnrollmentDto(
            id = UUID.randomUUID(),
            lastOsName = "Linux",
            deviceType = "Desktop",
            remoteAddr = "192.0.2.10",
            createdAt = Instant.parse("2026-08-10T12:00:00Z"),
        )
        val response = DeviceEnrollmentsResponseDto(listOf(enrollment))

        whenever(deviceInfoService.getDeviceEnrollments(userId))
            .thenReturn(response)

        mockMvc.perform(
            get("/device/enrollments")
                .with(jwtPrincipal(deviceId, userId))
        )
            .andExpect(status().isOk)

        verify(deviceInfoService).getDeviceEnrollments(userId)
    }

    @Test
    fun `approve enrollment delegates authenticated device and user to service`() {
        val deviceId = UUID.randomUUID()
        val userId = UUID.randomUUID()
        val enrollmentId = UUID.randomUUID()

        mockMvc.perform(
            post("/device/enrollment/$enrollmentId/approve")
                .with(jwtPrincipal(deviceId, userId))
        )
            .andExpect(status().isOk)

        verify(deviceInfoService).approveDeviceEnrollment(deviceId, userId, enrollmentId)
    }

    @Test
    fun `approve enrollment returns not found when enrollment does not exist`() {
        val deviceId = UUID.randomUUID()
        val userId = UUID.randomUUID()
        val enrollmentId = UUID.randomUUID()

        doThrow(NoSuchElementException())
            .whenever(deviceInfoService)
            .approveDeviceEnrollment(deviceId, userId, enrollmentId)

        mockMvc.perform(
            post("/device/enrollment/$enrollmentId/approve")
                .with(jwtPrincipal(deviceId, userId))
        ).andExpect(status().isNotFound)
    }

    @Test
    fun `approve enrollment returns forbidden when approval is not allowed`() {
        val deviceId = UUID.randomUUID()
        val userId = UUID.randomUUID()
        val enrollmentId = UUID.randomUUID()

        doThrow(AccessDeniedException("Approval is not allowed"))
            .whenever(deviceInfoService)
            .approveDeviceEnrollment(deviceId, userId, enrollmentId)

        mockMvc.perform(
            post("/device/enrollment/$enrollmentId/approve")
                .with(jwtPrincipal(deviceId, userId))
        ).andExpect(status().isForbidden)
    }

    @Test
    fun `create enrollment returns enrollment and challenge`() {
        val request = CreateDeviceEnrollmentRequestDto(
            userAgent = "Linux",
            publicIdentityKey = generateKeyPair().toPublicJWK().toJSONObject(),
        )
        val response = CreateDeviceEnrollmentResponseDto(
            enrollmentId = "enrollment-id",
            challenge = GenerateChallengeResponseDto(
                nonce = "url-safe-nonce",
                expiresAt = Instant.parse("2026-08-09T18:00:30Z"),
                challengeId = UUID.randomUUID(),
            ),
        )

        whenever(deviceInfoService.createDeviceEnrollment(request, "127.0.0.1"))
            .thenReturn(response)

        mockMvc.perform(
            post("/device/enrollment")
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(request))
        )
            .andExpect(status().isOk)

        verify(deviceInfoService).createDeviceEnrollment(request, "127.0.0.1")
    }

    @Test
    fun `retrying create enrollment with same idempotency key returns original response`() {
        simulateIdempotencyCache()

        val idempotencyKey = UUID.randomUUID()
        val request = CreateDeviceEnrollmentRequestDto(
            userAgent = "Linux",
            publicIdentityKey = generateKeyPair().toPublicJWK().toJSONObject(),
        )
        val response = CreateDeviceEnrollmentResponseDto(
            enrollmentId = "enrollment-id",
            challenge = GenerateChallengeResponseDto(
                nonce = "url-safe-nonce",
                expiresAt = Instant.parse("2026-08-09T18:00:30Z"),
                challengeId = UUID.randomUUID(),
            ),
        )

        whenever(deviceInfoService.createDeviceEnrollment(request, "127.0.0.1"))
            .thenReturn(response)

        repeat(2) {
            mockMvc.perform(
                post("/device/enrollment")
                    .header("Idempotency-Key", idempotencyKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(jsonMapper.writeValueAsString(request))
            )
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.enrollmentId").value(response.enrollmentId))
                .andExpect(jsonPath("$.challenge.challengeId").value(response.challenge.challengeId.toString()))
        }

        verify(deviceInfoService, times(1)).createDeviceEnrollment(request, "127.0.0.1")
    }

    @Test
    fun `confirm enrollment returns registered device id`() {
        val userId = UUID.randomUUID()
        val request = ConfirmDeviceEnrollmentRequestDto(
            enrollmentId = "enrollment-id",
            challengeId = UUID.randomUUID(),
            signature = "signed-nonce",
        )
        val deviceId = UUID.randomUUID()

        whenever(
            deviceInfoService.confirmDeviceEnrollmentChallenge(
                request.enrollmentId,
                request.challengeId,
                request.signature,
                userId,
            )
        ).thenReturn(deviceId)

        mockMvc.perform(
            post("/device/enrollment/challenge")
                .header("Idempotency-Key", UUID.randomUUID())
                .with(jwtPrincipal(UUID.randomUUID(), userId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(request))
        )
            .andExpect(status().isOk)

        verify(deviceInfoService).confirmDeviceEnrollmentChallenge(
            request.enrollmentId,
            request.challengeId,
            request.signature,
            userId,
        )
    }

    @Test
    fun `retrying enrollment confirmation with same idempotency key returns original device id`() {
        simulateIdempotencyCache()

        val idempotencyKey = UUID.randomUUID()
        val userId = UUID.randomUUID()
        val request = ConfirmDeviceEnrollmentRequestDto(
            enrollmentId = "enrollment-id",
            challengeId = UUID.randomUUID(),
            signature = "signed-nonce",
        )
        val deviceId = UUID.randomUUID()

        whenever(
            deviceInfoService.confirmDeviceEnrollmentChallenge(
                request.enrollmentId,
                request.challengeId,
                request.signature,
                userId,
            )
        ).thenReturn(deviceId)

        repeat(2) {
            mockMvc.perform(
                post("/device/enrollment/challenge")
                    .header("Idempotency-Key", idempotencyKey)
                    .with(jwtPrincipal(UUID.randomUUID(), userId))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(jsonMapper.writeValueAsString(request))
            )
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.deviceId").value(deviceId.toString()))
        }

        verify(deviceInfoService, times(1)).confirmDeviceEnrollmentChallenge(
            request.enrollmentId,
            request.challengeId,
            request.signature,
            userId,
        )
    }

    @Test
    fun `confirm enrollment rejects malformed challenge id`() {
        val payload = """
            {
                "enrollmentId": "enrollment-id",
                "challengeId": "not-a-uuid",
                "signature": "signed-nonce"
            }
        """.trimIndent()

        mockMvc.perform(
            post("/device/enrollment/challenge")
                .header("Idempotency-Key", UUID.randomUUID())
                .with(jwtPrincipal(UUID.randomUUID()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload)
        )
            .andExpect(status().isBadRequest)
            .andExpect { assertIs<HttpMessageNotReadableException>(it.resolvedException) }
    }

    @Test
    fun `register returns deviceId with correct request`() {
        val deviceId = UUID.randomUUID()
        val publicIdKey = generateKeyPair()
            .toPublicJWK()
            .toJSONObject()


        whenever(deviceInfoService.registerDevice(any(), any(), any()))
            .thenReturn(deviceId)

        val content = jsonMapper.writeValueAsString(
            RegisterDeviceRequestDto(
                userId = UUID.randomUUID(),
                "Windows",
                "eb:05:fb:e3:2a:63",
                publicIdKey,
            )
        )

        mockMvc.perform(
            post("/internal/device")
                .contentType(MediaType.APPLICATION_JSON)
                .content(content)
        )
            .andExpect(status().isOk)
            .andExpect(
                jsonPath("$.deviceId").value(
                    deviceId.toString()
                )
            )
    }

    @Test
    fun `register fails when user id is invalid`() {
        val publicIdKey = generateKeyPair()
            .toPublicJWK()
            .toJSONObject()

        val payload = """
            {
                "userId": "INVALID-UUID",
                "userAgent": "Windows",
                "remoteAddr": "127.0.0.1",
                "publicIdentityKey": ${jsonMapper.writeValueAsString(publicIdKey)}
            }
        """.trimIndent()

        mockMvc.perform(
            post("/internal/device")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload)
        )
            .andExpect { result -> assert(result.resolvedException is HttpMessageNotReadableException) }
            .andExpect(status().isBadRequest)
    }

    @Test
    fun `block device sends correct request and returns success`() {
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")
        val targetDeviceId = UUID.fromString("a9d3015a-27c9-4259-89e7-84142a939631")

        mockMvc.perform(
            post("/device/block")
                .with(jwtPrincipal(deviceId))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"targetDeviceId":"$targetDeviceId"}""")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.message").isNotEmpty)

        verify(deviceInfoService)
            .setDeviceBlocked(deviceId, targetDeviceId, true)
    }

    @Test
    fun `block device fails when target device id is invalid`() {
        mockMvc.perform(
            post("/device/block")
                .with(jwtPrincipal(UUID.randomUUID()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"targetDeviceId":"INVALID-UUID"}""")
        )
            .andExpect(status().isBadRequest)
            .andExpect { assertIs<HttpMessageNotReadableException>(it.resolvedException) }
    }

    @Test
    fun `block device fails validation when target device id is missing`() {
        mockMvc.perform(
            post("/device/block")
                .with(jwtPrincipal(UUID.randomUUID()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{}""")
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.errors[0].field").value("targetDeviceId"))
            .andExpect(jsonPath("$.errors[0].message").isNotEmpty)
    }

    @Test
    fun `block device returns bad request when device blocks itself`() {
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")

        whenever {
            deviceInfoService.setDeviceBlocked(eq(deviceId), eq(deviceId), eq(true))
        }.thenThrow(SelfLockNotAllowedException("Device cannot be blocked by itself"))

        mockMvc.perform(
            post("/device/block")
                .with(jwtPrincipal(deviceId))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"targetDeviceId":"$deviceId"}""")
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").isNotEmpty)
    }

    @Test
    fun `block device returns forbidden when target belongs to different account`() {
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")
        val targetDeviceId = UUID.fromString("a9d3015a-27c9-4259-89e7-84142a939631")

        whenever {
            deviceInfoService.setDeviceBlocked(eq(deviceId), eq(targetDeviceId), eq(true))
        }.thenThrow(AccessDeniedException("You are not owner of this device"))

        mockMvc.perform(
            post("/device/block")
                .with(jwtPrincipal(deviceId))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"targetDeviceId":"$targetDeviceId"}""")
        )
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.message").isNotEmpty)
    }

    @Test
    fun `block device returns locked when target is already blocked`() {
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")
        val targetDeviceId = UUID.fromString("a9d3015a-27c9-4259-89e7-84142a939631")

        whenever {
            deviceInfoService.setDeviceBlocked(eq(deviceId), eq(targetDeviceId), eq(true))
        }.thenThrow(LockedException("This device is already blocked"))

        mockMvc.perform(
            post("/device/block")
                .with(jwtPrincipal(deviceId))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"targetDeviceId":"$targetDeviceId"}""")
        )
            .andExpect(status().isLocked)
            .andExpect(jsonPath("$.message").isNotEmpty)
    }

    @Test
    fun `block device returns not found when device does not exist`() {
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")
        val targetDeviceId = UUID.fromString("a9d3015a-27c9-4259-89e7-84142a939631")

        whenever {
            deviceInfoService.setDeviceBlocked(eq(deviceId), eq(targetDeviceId), eq(true))
        }.thenThrow(NoSuchElementException("No device found with id $targetDeviceId"))

        mockMvc.perform(
            post("/device/block")
                .with(jwtPrincipal(deviceId))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"targetDeviceId":"$targetDeviceId"}""")
        )
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.message").isNotEmpty)
    }

    @Test
    fun `get is blocked returns device blocked status`() {
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")

        whenever(deviceInfoService.getIsBlocked(deviceId))
            .thenReturn(true)

        mockMvc.perform(
            get("/internal/device/$deviceId/block")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.isBlocked").value(true))

        verify(deviceInfoService)
            .getIsBlocked(deviceId)
    }

    @Test
    fun `get is blocked returns not found when device does not exist`() {
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")

        whenever(deviceInfoService.getIsBlocked(deviceId))
            .thenThrow(NoSuchElementException("No device found with id $deviceId"))

        mockMvc.perform(
            get("/internal/device/$deviceId/block")
        )
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.message").isNotEmpty)
    }

    @Test
    fun `get identity key returns identity key`() {
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")
        val userId = UUID.fromString("2acc1ac6-a803-4c50-8645-39fa583aab88")

        val expectedKey = OctetKeyPairGenerator(Curve.Ed25519)
            .generate()
            .toPublicJWK()

        whenever {
            deviceInfoService.getIdentityKey(userId, deviceId)
        }.thenReturn(
            expectedKey
        )

        mockMvc.perform(
            get("/device/$deviceId/identity-key")
                .with(jwtPrincipal(deviceId, userId))
        ).andExpect(status().isOk)
            .andExpect { jsonPath("$").value(
                expectedKey.toJSONObject()
            ) }
    }

    @Test
    fun `get identity key returns not found when device does not exist`() {
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")
        val userId = UUID.fromString("2acc1ac6-a803-4c50-8645-39fa583aab88")

        whenever {
            deviceInfoService.getIdentityKey(userId, deviceId)
        }.thenThrow(
            NoSuchElementException("No device found with id $deviceId")
        )

        mockMvc.perform(
            get("/device/$deviceId/identity-key")
                .with(jwtPrincipal(deviceId, userId))
        ).andExpect(status().isNotFound)
    }

    @Test
    fun `get identity key returns not found when device does not belong to user`() {
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")
        val userId = UUID.fromString("2acc1ac6-a803-4c50-8645-39fa583aab88")

        whenever {
            deviceInfoService.getIdentityKey(userId, deviceId)
        }.thenThrow(
            AccessDeniedException("You are not owner of this device")
        )

        mockMvc.perform(
            get("/device/$deviceId/identity-key")
                .with(jwtPrincipal(deviceId, userId))
        ).andExpect(status().isForbidden)
    }

    private fun jwtPrincipal(deviceId: UUID, userId: UUID = UUID.randomUUID()): RequestPostProcessor = RequestPostProcessor { request ->
        val jwt = Jwt.withTokenValue("token")
            .header("alg", "none")
            .subject(userId.toString())
            .claim("device_id", deviceId.toString())
            .build()

        SecurityContextHolder.getContext().authentication = JwtAuthenticationToken(jwt)
        request
    }

    private fun simulateIdempotencyCache() {
        val storedEntries = mutableMapOf<UUID, IdempotencyKey>()

        whenever(idempotencyKeyRepository.findById(any()))
            .thenAnswer { invocation ->
                Optional.ofNullable(storedEntries[invocation.getArgument(0)])
            }

        doAnswer { invocation ->
            val entry = invocation.getArgument<IdempotencyKey>(0)
            storedEntries[entry.idempotencyKey] = entry
            entry
        }.whenever(idempotencyKeyRepository).save(any())
    }
}
