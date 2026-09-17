package pl.dayfit.mossyauth.repository.redis

import org.springframework.data.repository.CrudRepository
import org.springframework.stereotype.Repository
import pl.dayfit.mossyauth.model.redis.EmailVerificationRequest
import java.util.UUID

@Repository
interface EmailVerificationRepository : CrudRepository<EmailVerificationRequest, UUID>
