package pl.dayfit.mossystatistics.repository

import org.springframework.data.jpa.repository.JpaRepository
import pl.dayfit.mossystatistics.model.VaultStatistics
import java.util.UUID

interface VaultStatisticsRepository : JpaRepository<VaultStatistics, UUID>
