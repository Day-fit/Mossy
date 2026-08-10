package pl.dayfit.mossydevicetrust.controller

import org.mockito.kotlin.verify
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
import pl.dayfit.mossydevicetrust.service.NonceChallengeService
import pl.dayfit.mossydevicetrustshared.dto.request.VerifyNonceChallengeRequestDto
import pl.dayfit.mossydevicetrustshared.dto.response.NonceChallengeResponseDto
import tools.jackson.module.kotlin.jsonMapper
import java.util.UUID
import kotlin.test.Test

@WebMvcTest(InternalNonceChallengeController::class)
@AutoConfigureMockMvc(addFilters = false)
class InternalNonceChallengeControllerTest(
    @Autowired private val mockMvc: MockMvc,
) {
    @MockitoBean
    private lateinit var nonceChallengeService: NonceChallengeService

    private val jsonMapper = jsonMapper { }

    @Test
    fun `internal challenge verification uses authenticated user supplied by auth service`() {
        val request = VerifyNonceChallengeRequestDto(
            userId = UUID.randomUUID(),
            deviceId = UUID.randomUUID(),
            challengeId = UUID.randomUUID(),
            signature = "signed-nonce",
            os = "Linux",
            remoteAddr = "192.0.2.1",
        )

        whenever(
            nonceChallengeService.isLoginChallengeValid(
                request.challengeId,
                request.signature,
                request.deviceId,
                request.userId,
            )
        ).thenReturn(NonceChallengeResponseDto(success = true, alertSent = false))

        mockMvc.perform(
            post("/internal/nonce/challenge")
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(request))
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))

        verify(nonceChallengeService).isLoginChallengeValid(
            request.challengeId,
            request.signature,
            request.deviceId,
            request.userId,
        )
    }
}
