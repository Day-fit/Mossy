package pl.dayfit.mossystatistics.controller

import org.springframework.http.HttpHeaders
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestHeader
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
    fun getDashboardStatistics(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorizationHeader: String
    ): DashboardResponseDto {
        return statisticsQueryService.getDashboardStatistics(authorizationHeader)
    }
}
