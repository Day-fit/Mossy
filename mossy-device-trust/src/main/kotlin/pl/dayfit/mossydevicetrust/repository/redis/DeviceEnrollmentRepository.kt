package pl.dayfit.mossydevicetrust.repository.redis

import org.springframework.data.repository.CrudRepository
import org.springframework.stereotype.Repository
import pl.dayfit.mossydevicetrust.model.redis.DeviceEnrollment

@Repository
interface DeviceEnrollmentRepository : CrudRepository<DeviceEnrollment, String>