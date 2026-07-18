package pl.dayfit.mossydevicetrust.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import pl.dayfit.mossydevicetrust.model.DeviceInfo
import java.util.UUID

@Repository
interface DeviceInfoRepository : JpaRepository<DeviceInfo, UUID> {
}
