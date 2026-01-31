package pl.dayfit.mossycore.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import pl.dayfit.mossycore.model.UserDevice
import java.util.UUID

@Repository
interface UserDeviceRepository : JpaRepository<UserDevice, UUID>