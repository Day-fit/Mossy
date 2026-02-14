package pl.dayfit.mossyauth.service

import org.springframework.stereotype.Service
import pl.dayfit.mossyauth.model.RevokedJwtModel
import pl.dayfit.mossyauth.repository.RevokedJwtRepository
import java.time.Instant

@Service
class JwtManagementService(
    private val revokedJwtRepository: RevokedJwtRepository
) {
    fun revokeToken(jwtToken: String)
    {
        revokedJwtRepository.save(
            RevokedJwtModel(
                token = jwtToken,
                validUntil = Instant.now()
            )
        )
    }
}