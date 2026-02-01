package pl.dayfit.mossydevice.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import pl.dayfit.mossydevice.model.UserDevice
import java.util.UUID

@Repository
interface UserDeviceRepository : JpaRepository<UserDevice, UUID> {
    fun existsUserDevicesByUserIdAndApproved(userId: UUID, approved: Boolean): Boolean
}