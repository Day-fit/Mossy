package pl.dayfit.mossypassword.controller

import messaging.request.PasswordMetadataDto
import messaging.response.type.CiphertextResponseType
import messaging.response.type.MetadataResponseType
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import org.mockito.kotlin.argThat
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.springframework.http.MediaType
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.patch
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.bind.MethodArgumentNotValidException
import pl.dayfit.mossypassword.controller.advice.GlobalControllerAdvice
import pl.dayfit.mossypassword.dto.request.DeletePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.SavePasswordRequestDto
import pl.dayfit.mossypassword.dto.request.UpdatePasswordRequestDto
import pl.dayfit.mossypassword.exception.VaultNotFoundException
import pl.dayfit.mossypassword.service.PasswordManagementService
import tools.jackson.databind.json.JsonMapper
import type.PasswordType
import java.time.Instant
import java.util.UUID
import java.util.concurrent.CompletableFuture
import kotlin.test.assertEquals
import kotlin.test.assertIs

class PasswordControllerTest {

    private val userId = UUID.randomUUID()
    private val passwordManagementService: PasswordManagementService = mock()
    private val mockMvc = MockMvcBuilders.standaloneSetup(PasswordController(passwordManagementService))
        .setControllerAdvice(GlobalControllerAdvice())
        .setCustomArgumentResolvers(AuthenticationPrincipalArgumentResolver())
        .build()
    private val objectMapper = JsonMapper.builder().build()

    @BeforeEach
    fun authenticate() {
        val jwt = Jwt.withTokenValue("test-token")
            .header("alg", "none")
            .subject(userId.toString())
            .build()
        SecurityContextHolder.getContext().authentication = JwtAuthenticationToken(jwt)
    }

    @AfterEach
    fun clearAuthentication() {
        SecurityContextHolder.clearContext()
    }

    @ParameterizedTest
    @ValueSource(strings = ["example.com", "ftp://example.com", ""])
    fun `invalid address prefix returns bad request response`(address: String) {
        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            address = address,
            cipherText = "QmFzZTY0Q2lwaGVy",
            vaultId = UUID.randomUUID(),
            passwordType = PasswordType.PASSWORD
        )

        mockMvc.post("/save") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(request)
        }.andExpect {
            status { isBadRequest() }
            match {
                val exception = assertIs<MethodArgumentNotValidException>(it.resolvedException)
                assertEquals("address", exception.bindingResult.fieldError?.field)
            }
        }
        verifyNoInteractions(passwordManagementService)
    }

    @ParameterizedTest
    @ValueSource(strings = ["http://example.com", "https://example.com", "ssh://example.com", "HTTPS://example.com"])
    fun `save endpoint forwards payload and returns accepted response`(address: String) {
        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            address = address,
            cipherText = "QmFzZTY0Q2lwaGVy",
            vaultId = UUID.randomUUID(),
            passwordType = PasswordType.PASSWORD
        )

        mockMvc.post("/save") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(request)
        }.andExpect {
            status { isOk() }
            jsonPath("$.message") { value("Password save request accepted") }
        }
        verify(passwordManagementService).savePassword(userId, request)
    }

    @Test
    fun `save endpoint returns not found when vault does not exist`() {
        val vaultId = UUID.randomUUID()
        val request = SavePasswordRequestDto(
            identifier = "john@example.com",
            address = "http://example.com",
            cipherText = "QmFzZTY0Q2lwaGVy",
            vaultId = vaultId,
            passwordType = PasswordType.PASSWORD
        )
        val exception = VaultNotFoundException(vaultId)
        whenever(passwordManagementService.savePassword(userId, request)).thenThrow(exception)

        mockMvc.post("/save") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(request)
        }.andExpect {
            status { isNotFound() }
            jsonPath("$.message") { value(exception.message) }
        }
        verify(passwordManagementService).savePassword(userId, request)
    }

    @Test
    fun `update endpoint forwards request to service`() {
        val request = UpdatePasswordRequestDto(
            passwordId = UUID.randomUUID(),
            identifier = "john@example.com",
            address = "http://example.com",
            cipherText = "QmFzZTY0Q2lwaGVy",
            vaultId = UUID.randomUUID()
        )

        mockMvc.patch("/update") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(request)
        }.andExpect {
            status { isOk() }
            jsonPath("$.message") { value("Password updated successfully") }
        }
        verify(passwordManagementService).updatePassword(userId, request)
    }

    @Test
    fun `delete endpoint forwards request to service`() {
        val request = DeletePasswordRequestDto(UUID.randomUUID(), UUID.randomUUID())

        mockMvc.delete("/delete") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(request)
        }.andExpect {
            status { isOk() }
            jsonPath("$.message") { value("Password deleted successfully") }
        }
        verify(passwordManagementService).deletePassword(eq(userId), argThat {
            passwordId == request.passwordId && vaultId == request.vaultId
        })
    }

    @Test
    fun `get metadata endpoint returns values from management service`() {
        val vaultId = UUID.randomUUID()
        val first = PasswordMetadataDto(
            passwordId = UUID.randomUUID(),
            identifier = "john@example.com",
            address = "http://example.com",
            lastModified = Instant.now(),
            tags = listOf(),
            hasNote = false,
            passwordType = PasswordType.PASSWORD
        )
        val second = PasswordMetadataDto(
            passwordId = UUID.randomUUID(),
            identifier = "anna@example.com",
            address = "http://example.com",
            lastModified = Instant.now(),
            tags = listOf(),
            hasNote = true,
            passwordType = PasswordType.PASSWORD
        )
        val metadata = listOf(first, second)
        whenever(passwordManagementService.getPasswordsMetadata(userId, vaultId))
            .thenReturn(CompletableFuture.completedFuture(MetadataResponseType(metadata)))

        mockMvc.get("/metadata") {
            param("vaultId", vaultId.toString())
        }.asyncDispatch().andExpect {
            status { isOk() }
            content { json(objectMapper.writeValueAsString(metadata)) }
        }
        verify(passwordManagementService).getPasswordsMetadata(userId, vaultId)
    }

    @Test
    fun `get ciphertext endpoint returns body when service returns ciphertext`() {
        val vaultId = UUID.randomUUID()
        val passwordId = UUID.randomUUID()
        val ciphertext = CiphertextResponseType("BASE64", passwordId)
        whenever(passwordManagementService.getPasswordCipherText(userId, vaultId, passwordId))
            .thenReturn(CompletableFuture.completedFuture(ciphertext))

        mockMvc.get("/ciphertext/{passwordId}", passwordId) {
            param("vaultId", vaultId.toString())
        }.asyncDispatch().andExpect {
            status { isOk() }
            content { json(objectMapper.writeValueAsString(ciphertext)) }
        }
        verify(passwordManagementService).getPasswordCipherText(userId, vaultId, passwordId)
    }
}
