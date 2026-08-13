package pl.dayfit.mossydevicetrust.controller

import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import pl.dayfit.mossydevicetrust.service.NonceChallengeService
import pl.dayfit.mossydevicetrust.type.NonceChallengeTarget
import pl.dayfit.mossydevicetrustshared.dto.response.GenerateChallengeResponseDto
import java.time.Duration
import java.time.Instant
import java.util.UUID

@WebMvcTest(NonceChallengeController::class)
@AutoConfigureMockMvc(addFilters = false)
class NonceChallengeControllerTest(
    @Autowired private val mockMvc: MockMvc
) {
    @MockitoBean
    private val nonceChallengeService: NonceChallengeService = mock()

    @Test
    fun `Generation of nonce returns correct response`() {
        val deviceId = UUID.randomUUID()
        val deviceIdString = deviceId.toString()
        val challengeId = UUID.randomUUID()
        val nonce = "26OGBGX2FbwLjCEqjVudqg"

        whenever { nonceChallengeService.generateNonce(deviceIdString, NonceChallengeTarget.EXISTING_DEVICE) }
            .thenReturn(
                GenerateChallengeResponseDto(
                    nonce,
                    Instant.now().plus(Duration.ofMinutes(5)),
                    challengeId
                )
            )

        mockMvc.perform(
            get("/nonce/$deviceId")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.nonce").value(nonce))
            .andExpect(jsonPath("$.challengeId")
                .value(challengeId.toString())
            )
    }
}
