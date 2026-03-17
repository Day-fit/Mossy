package pl.dayfit.mossystatistics.controller

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossystatistics.dto.response.DashboardResponseDto
import pl.dayfit.mossystatistics.service.StatisticsQueryService

@RestController
@RequestMapping("/dashboard")
class StatisticsController(
    private val statisticsQueryService: StatisticsQueryService
) {
    @GetMapping
    fun getDashboardStatistics(): DashboardResponseDto {
        return statisticsQueryService.getDashboardStatistics()
    }
}
