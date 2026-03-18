package pl.dayfit.mossypassword.controller

import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
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
import pl.dayfit.mossypassword.service.PasswordQueryService
import pl.dayfit.mossypassword.service.VaultCommunicationService
import pl.dayfit.mossypassword.service.exception.VaultNotConnectedException
import pl.dayfit.mossypassword.service.exception.VaultNotFoundException
import java.util.UUID

@WebMvcTest(PasswordController::class)
@AutoConfigureMockMvc(addFilters = false)
class PasswordControllerMvcTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @MockitoBean
    lateinit var vaultCommunicationService: VaultCommunicationService

    @MockitoBean
    lateinit var passwordQueryService: PasswordQueryService

    @Test
    fun `save endpoint forwards payload to service`() {
        val vaultId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()
        val requestBody = """
            {
              "identifier": "john@example.com",
              "domain": "example.com",
              "cipherText": "QmFzZTY0Q2lwaGVy",
              "vaultId": "$vaultId"
            }
        """.trimIndent()

        whenever(vaultCommunicationService.savePassword(any())).thenReturn(passwordId)

        mockMvc.perform(
            post("/password/save")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.message").value("Password save request accepted"))
            .andExpect(jsonPath("$.passwordId").value(passwordId.toString()))

        verify(vaultCommunicationService, times(1)).savePassword(any())
    }

    @Test
    fun `save endpoint returns 503 when vault is offline`() {
        val vaultId = UUID.randomUUID()
        val requestBody = """
            {
              "identifier": "john@example.com",
              "domain": "example.com",
              "cipherText": "QmFzZTY0Q2lwaGVy",
              "vaultId": "$vaultId"
            }
        """.trimIndent()

        whenever(vaultCommunicationService.savePassword(any())).thenThrow(VaultNotConnectedException(vaultId))

        mockMvc.perform(
            post("/password/save")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody)
        )
            .andExpect(status().isServiceUnavailable)
            .andExpect(jsonPath("$.message").value("Vault with ID $vaultId is not connected"))
    }

    @Test
    fun `save endpoint returns 404 when vault does not exist`() {
        val vaultId = UUID.randomUUID()
        val requestBody = """
            {
              "identifier": "john@example.com",
              "domain": "example.com",
              "cipherText": "QmFzZTY0Q2lwaGVy",
              "vaultId": "$vaultId"
            }
        """.trimIndent()

        whenever(vaultCommunicationService.savePassword(any())).thenThrow(VaultNotFoundException(vaultId))

        mockMvc.perform(
            post("/password/save")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody)
        )
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.message").value("Vault with ID $vaultId does not exist"))
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

    @Test
    fun `get uuids endpoint returns values from query service`() {
        val vaultId = UUID.randomUUID()
        val first = UUID.randomUUID()
        val second = UUID.randomUUID()

        whenever(passwordQueryService.getPasswordUuidsByDomain(vaultId, "example.com"))
            .thenReturn(listOf(first, second))

        mockMvc.perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/password/uuids")
                .param("domain", "example.com")
                .param("vaultId", vaultId.toString())
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0]").value(first.toString()))
            .andExpect(jsonPath("$[1]").value(second.toString()))
    }

    @Test
    fun `get ciphertext endpoint returns 404 when service returns null`() {
        val vaultId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()

        whenever(passwordQueryService.getCiphertext(vaultId, passwordId)).thenReturn(null)

        mockMvc.perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/password/ciphertext/$passwordId")
                .param("vaultId", vaultId.toString())
        )
            .andExpect(status().isNotFound)
    }

    @Test
    fun `get ciphertext endpoint returns body when service returns ciphertext`() {
        val vaultId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()

        whenever(passwordQueryService.getCiphertext(vaultId, passwordId)).thenReturn("BASE64")

        mockMvc.perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/password/ciphertext/$passwordId")
                .param("vaultId", vaultId.toString())
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.ciphertext").value("BASE64"))
    }
}
