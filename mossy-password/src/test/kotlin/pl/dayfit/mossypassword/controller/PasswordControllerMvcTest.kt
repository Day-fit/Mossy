package pl.dayfit.mossypassword.controller

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import pl.dayfit.mossypassword.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossypassword.service.VaultCommunicationService
import java.util.UUID

@WebMvcTest(PasswordController::class)
@AutoConfigureMockMvc(addFilters = false)
class PasswordControllerMvcTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @MockitoBean
    lateinit var vaultCommunicationService: VaultCommunicationService

    @Test
    fun `save endpoint forwards payload to service`() {
        val vaultId = UUID.randomUUID()
        val requestBody = """
            {
              "identifier": "john@example.com",
              "domain": "example.com",
              "cipherText": "QmFzZTY0Q2lwaGVy",
              "vaultId": "$vaultId"
            }
        """.trimIndent()

        mockMvc.perform(
            post("/password/save")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.message").value("Passwords saved successfully"))

        verify(vaultCommunicationService, times(1)).savePassword(eq(vaultId), any())
    }

    @Test
    fun `extract ciphertext endpoint forwards request to service`() {
        val vaultId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()
        val requestBody = """
            {
              "passwordId": "$passwordId",
              "vaultId": "$vaultId"
            }
        """.trimIndent()

        mockMvc.perform(
            post("/password/extract-ciphertext")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.message").value("Ciphertext extraction requested successfully"))

        verify(vaultCommunicationService, times(1)).extractCiphertext(vaultId, passwordId)
    }

    @Test
    fun `update endpoint forwards request to service`() {
        val request = UpdatePasswordRequestDto(
            passwordId = UUID.randomUUID(),
            identifier = "john@example.com",
            domain = "example.com",
            cipherText = "QmFzZTY0Q2lwaGVy",
            vaultId = UUID.randomUUID()
        )

        val requestBody = """
            {
              "passwordId": "${request.passwordId}",
              "identifier": "${request.identifier}",
              "domain": "${request.domain}",
              "cipherText": "${request.cipherText}",
              "vaultId": "${request.vaultId}"
            }
        """.trimIndent()

        mockMvc.perform(
            patch("/password/update")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.message").value("Password updated successfully"))

        verify(vaultCommunicationService, times(1)).updatePassword(eq(request))
    }

    @Test
    fun `delete endpoint forwards request to service`() {
        val vaultId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()
        val requestBody = """
            {
              "passwordId": "$passwordId",
              "vaultId": "$vaultId"
            }
        """.trimIndent()

        mockMvc.perform(
            delete("/password/delete")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.message").value("Passwords deleted successfully"))

        verify(vaultCommunicationService, times(1)).deletePassword(vaultId, passwordId)
    }
}
