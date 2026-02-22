package pl.dayfit.mossyauth.controller

import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import pl.dayfit.mossyauth.dto.response.UserDetailsResponseDto
import pl.dayfit.mossyauth.service.UserService
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl
import java.util.UUID

@WebMvcTest(UserController::class)
class UserControllerTests {

    @MockitoBean
    private val userService: UserService = mock()
    @Autowired
    lateinit var mockMvc: MockMvc

    /**
     * /user/details tests
     */

    @Test
    fun `test get user details returns 200 and correct data`()
    {
        val userId = UUID.randomUUID()

        val expectedData = UserDetailsResponseDto(
            userId,
            "username",
            "email",
            listOf("USER")
        )

        val userDetails = UserDetailsImpl(
            "username",
            "password",
            userId,
            listOf(SimpleGrantedAuthority("USER"))
        )

        whenever(userService.getDetails(any()))
            .thenReturn(expectedData)

        mockMvc.perform(
            get("/user/details")
                .with(user(userDetails))
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.userId").value(expectedData.userId.toString()))
            .andExpect(jsonPath("$.username").value(expectedData.username))
            .andExpect(jsonPath("$.email").value(expectedData.email))
            .andExpect(jsonPath("$.grantedAuthorities[0]").value("USER"))
    }
}