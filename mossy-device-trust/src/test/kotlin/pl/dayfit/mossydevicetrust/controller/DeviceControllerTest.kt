package pl.dayfit.mossydevicetrust.controller

import com.nimbusds.jose.jwk.Curve
import com.nimbusds.jose.jwk.gen.OctetKeyPairGenerator
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
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
import pl.dayfit.mossydevicetrust.service.DeviceInfoService
import pl.dayfit.mossydevicetrustshared.dto.request.RegisterDeviceRequestDto
import tools.jackson.module.kotlin.jsonMapper
import java.util.*
import kotlin.test.Test
import kotlin.test.assertIs

@WebMvcTest(DeviceController::class)
@AutoConfigureMockMvc(addFilters = false)
class DeviceControllerTest(
    @Autowired val mockMvc: MockMvc,
) {
    @MockitoBean
    private lateinit var deviceInfoService: DeviceInfoService

    private val jsonMapper = jsonMapper { }

    @Test
    fun `register returns deviceId with correct request`() {
        val deviceId = UUID.randomUUID()
        val publicIdKey = generateKeyPair()
            .toPublicJWK()
            .toJSONObject()


        whenever(deviceInfoService.registerDevice(any()))
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
            post("/device")
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
                "osName": "Windows",
                "remoteAddr": "127.0.0.1",
                "publicIdentityKey": ${jsonMapper.writeValueAsString(publicIdKey)}
            }
        """.trimIndent()

        mockMvc.perform(
            post("/device")
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
            .andExpect(jsonPath("$.message").value("Device blocked successfully"))

        verify(deviceInfoService)
            .blockDevice(deviceId, targetDeviceId)
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
            .andExpect(jsonPath("$.errors[0].message").value("Target device id cannot be null"))
    }

    @Test
    fun `block device returns bad request when device blocks itself`() {
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")

        whenever {
            deviceInfoService.blockDevice(eq(deviceId), eq(deviceId))
        }.thenThrow(SelfLockNotAllowedException("Device cannot be blocked by itself"))

        mockMvc.perform(
            post("/device/block")
                .with(jwtPrincipal(deviceId))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"targetDeviceId":"$deviceId"}""")
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value("Device cannot be blocked by itself"))
    }

    @Test
    fun `block device returns forbidden when target belongs to different account`() {
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")
        val targetDeviceId = UUID.fromString("a9d3015a-27c9-4259-89e7-84142a939631")

        whenever {
            deviceInfoService.blockDevice(eq(deviceId), eq(targetDeviceId))
        }.thenThrow(AccessDeniedException("You are not owner of this device"))

        mockMvc.perform(
            post("/device/block")
                .with(jwtPrincipal(deviceId))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"targetDeviceId":"$targetDeviceId"}""")
        )
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.message").value("You are not owner of this device"))
    }

    @Test
    fun `block device returns locked when target is already blocked`() {
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")
        val targetDeviceId = UUID.fromString("a9d3015a-27c9-4259-89e7-84142a939631")

        whenever {
            deviceInfoService.blockDevice(eq(deviceId), eq(targetDeviceId))
        }.thenThrow(LockedException("This device is already blocked"))

        mockMvc.perform(
            post("/device/block")
                .with(jwtPrincipal(deviceId))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"targetDeviceId":"$targetDeviceId"}""")
        )
            .andExpect(status().isLocked)
            .andExpect(jsonPath("$.message").value("This device is already blocked"))
    }

    @Test
    fun `block device returns not found when device does not exist`() {
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")
        val targetDeviceId = UUID.fromString("a9d3015a-27c9-4259-89e7-84142a939631")

        whenever {
            deviceInfoService.blockDevice(eq(deviceId), eq(targetDeviceId))
        }.thenThrow(NoSuchElementException("No device found with id $targetDeviceId"))

        mockMvc.perform(
            post("/device/block")
                .with(jwtPrincipal(deviceId))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"targetDeviceId":"$targetDeviceId"}""")
        )
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.message").value("No device found with id $targetDeviceId"))
    }

    @Test
    fun `get is blocked returns device blocked status`() {
        val deviceId = UUID.fromString("638fdf8c-30e5-4d43-9940-0151558af33e")

        whenever(deviceInfoService.getIsBlocked(deviceId))
            .thenReturn(true)

        mockMvc.perform(
            get("/device/$deviceId/block")
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
            get("/device/$deviceId/block")
        )
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.message").value("No device found with id $deviceId"))
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
}
