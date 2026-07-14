package pl.dayfit.mossystatistics.controller

import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossystatistics.dto.response.DashboardResponseDto
import pl.dayfit.mossystatistics.service.StatisticsQueryService
import java.util.UUID

@RestController
@RequestMapping("/dashboard")
class StatisticsController(
    private val statisticsQueryService: StatisticsQueryService
) {
    @GetMapping
    fun getDashboardStatistics(
        @AuthenticationPrincipal jwt: Jwt
    ): DashboardResponseDto {
        val userId = UUID.fromString(jwt.subject)
        return statisticsQueryService.getDashboardStatistics(userId)
    }
}
