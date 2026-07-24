package pl.dayfit.mossydevicetrust.controller

import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.http.MediaType
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.MissingRequestHeaderException
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import pl.dayfit.mossydevicetrust.service.NonceChallengeService
import pl.dayfit.mossydevicetrustshared.dto.request.NonceChallengeRequestDto
import pl.dayfit.mossydevicetrustshared.dto.response.GenerateNonceResponseDto
import pl.dayfit.mossydevicetrustshared.dto.response.NonceChallengeResponseDto
import tools.jackson.module.kotlin.jsonMapper
import java.time.Duration
import java.time.Instant
import java.util.*
import kotlin.test.assertIs

@WebMvcTest(NonceChallengeController::class)
@AutoConfigureMockMvc(addFilters = false)
class NonceChallengeControllerTest(
    @Autowired private val mockMvc: MockMvc
) {
    @MockitoBean
    private val nonceChallengeService: NonceChallengeService = mock()
    private val jsonMapper = jsonMapper { }

    @Test
    fun `Generation of nonce returns correct response`() {
        val deviceId = UUID.randomUUID()
        val challengeId = UUID.randomUUID()
        val nonce = "26OGBGX2FbwLjCEqjVudqg"

        whenever { nonceChallengeService.generateNonce(deviceId) }
            .thenReturn(
                GenerateNonceResponseDto(
                    nonce,
                    Instant.now().plus(Duration.ofMinutes(5)),
                    challengeId
                )
            )

        mockMvc.perform(
            get("/nonce")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Device-Id", deviceId.toString())
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.nonce").value(nonce))
            .andExpect(jsonPath("$.challengeId")
                .value(challengeId.toString())
            )
    }

    @Test
    fun `Challenge creation fails when X-Device-Id header is missing`() {
        mockMvc.perform(
            get("/nonce")
                .contentType(MediaType.APPLICATION_JSON)
        ).andExpect(status().isBadRequest)
            .andExpect { assertIs<MissingRequestHeaderException>(it.resolvedException) }
    }

    @Test
    fun `Challenge creation fails when X-Device-Id header is invalid`() {
        mockMvc.perform(
            get("/nonce")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Device-Id", "Invalid-device-id")
        ).andExpect(status().isBadRequest)
            .andExpect { assertIs<MethodArgumentTypeMismatchException>(it.resolvedException) }
    }

    @Test
    fun `Challenge returns challenge response`() {
        val requestDto = NonceChallengeRequestDto(
            UUID.randomUUID(),
            "Signature is validated in service layer",
            "Windows",
            "96.3.61.11",
            UUID.randomUUID()
        )

        whenever(nonceChallengeService.isChallengeValid(any()))
            .thenReturn(
                NonceChallengeResponseDto(
                    success = true,
                    alertSent = false
                )
            )

        mockMvc.perform(
            post("/nonce/challenge")
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(requestDto))
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.alertSent").value(false))
    }

    @Test
    fun `Challenge returns challenge response when X-Device-Id header is missing`() {
        val requestDto = NonceChallengeRequestDto(
            UUID.randomUUID(),
            "Signature is validated in service layer",
            "MacOS",
            "96.3.61.11",
            UUID.randomUUID()
        )

        whenever(nonceChallengeService.isChallengeValid(any()))
            .thenReturn(
                NonceChallengeResponseDto(
                    success = false,
                    alertSent = false
                )
            )

        mockMvc.perform(
            post("/nonce/challenge")
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(requestDto))
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.alertSent").value(false))
    }

    @Test
    fun `Challenge fails when device ID in body is invalid`() {
        val payload = """
            {
                "challengeId": "${UUID.randomUUID()}",
                "signature": "Signature is validated in service layer",
                "os": "Linux",
                "remoteAddr": "96.3.61.11",
                "deviceId": "Invalid-device-id"
            }
        """.trimIndent()

        mockMvc.perform(
            post("/nonce/challenge")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload)
        ).andExpect(status().isBadRequest)
            .andExpect { assertIs<HttpMessageNotReadableException>(it.resolvedException) }
    }
}
