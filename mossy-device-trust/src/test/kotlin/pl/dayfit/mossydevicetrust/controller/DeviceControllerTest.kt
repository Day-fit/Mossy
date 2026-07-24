package pl.dayfit.mossydevicetrust.controller

import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.http.MediaType
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.http.converter.HttpMessageNotReadableException
import pl.dayfit.mossydevicetrust.helper.KeygenHelper.generateKeyPair
import pl.dayfit.mossydevicetrust.service.DeviceInfoService
import pl.dayfit.mossydevicetrustshared.dto.request.RegisterDeviceRequestDto
import tools.jackson.module.kotlin.jsonMapper
import java.util.*
import kotlin.test.Test

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
}
