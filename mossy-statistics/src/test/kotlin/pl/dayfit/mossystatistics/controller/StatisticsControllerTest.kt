package pl.dayfit.mossystatistics.controller

import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.springframework.security.oauth2.jwt.Jwt
import pl.dayfit.mossystatistics.dto.response.DashboardResponseDto
import pl.dayfit.mossystatistics.service.StatisticsQueryService
import java.util.UUID
import kotlin.test.assertEquals

class StatisticsControllerTest {
    private val statisticsQueryService: StatisticsQueryService = mock()
    private val controller = StatisticsController(statisticsQueryService)

    @Test
    fun `get dashboard statistics uses JWT subject as user id`() {
        val userId = UUID.randomUUID()
        val jwt: Jwt = mock()
        val response = DashboardResponseDto(emptyList(), emptyList())
        `when`(jwt.subject).thenReturn(userId.toString())
        `when`(statisticsQueryService.getDashboardStatistics(userId)).thenReturn(response)

        assertEquals(response, controller.getDashboardStatistics(jwt))
        verify(statisticsQueryService).getDashboardStatistics(userId)
    }
}
