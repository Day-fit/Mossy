package pl.dayfit.mossydevicetrust.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import pl.dayfit.mossydevicetrust.model.DeviceEnrollmentRequest
import java.util.UUID

@Repository
interface DeviceEnrollmentRequestRepository : JpaRepository<DeviceEnrollmentRequest, UUID> {
    fun findByUserId(userId: UUID): MutableList<DeviceEnrollmentRequest>
}