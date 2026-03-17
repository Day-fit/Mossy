package pl.dayfit.mossystatistics.controller

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import pl.dayfit.mossystatistics.service.StatisticsQueryService

@SpringBootTest
@AutoConfigureMockMvc
class StatisticsControllerSecurityTest(
    @Autowired private val mockMvc: MockMvc
) {
    @MockitoBean
    lateinit var statisticsQueryService: StatisticsQueryService

    @Test
    fun dashboardRequiresAuthentication() {
        mockMvc.perform(get("/dashboard"))
            .andExpect(status().is4xxClientError)
    }
}
