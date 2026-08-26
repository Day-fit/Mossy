package pl.dayfit.mossyauth.controller

import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import pl.dayfit.mossyauth.exception.SigningKeyNotInitializedException
import pl.dayfit.mossyauth.service.JwksService
import kotlin.test.Test

@WebMvcTest(JwksController::class)
@AutoConfigureMockMvc(addFilters = false)
class JwksControllerTest(
    @Autowired val mockMvc: MockMvc,
) {
    @MockitoBean
    private lateinit var jwksService: JwksService

    @Test
    fun `jwks returns keys`() {
        whenever(jwksService.getJwks())
            .thenReturn(
                mapOf(
                    "keys" to listOf(
                        mapOf(
                            "kid" to "test-key-id",
                            "kty" to "OKP"
                        )
                    )
                )
            )

        mockMvc.perform(get("/.well-known/jwks.json"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.keys[0].kid").value("test-key-id"))
            .andExpect(jsonPath("$.keys[0].kty").value("OKP"))
    }

    @Test
    fun `jwks returns service unavailable when signing key is not initialized`() {
        whenever(jwksService.getJwks())
            .thenThrow(SigningKeyNotInitializedException("Signing key is not initialized"))

        mockMvc.perform(get("/.well-known/jwks.json"))
            .andExpect(status().isServiceUnavailable)
            .andExpect(jsonPath("$.message").value("Signing key is not initialized"))
    }
}
