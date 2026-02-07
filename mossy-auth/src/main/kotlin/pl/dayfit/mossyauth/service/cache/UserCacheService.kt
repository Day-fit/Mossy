package pl.dayfit.mossyauth.service.cache

import org.springframework.cache.annotation.CachePut
import org.springframework.stereotype.Service
import pl.dayfit.mossyauth.model.UserModel
import pl.dayfit.mossyauth.repository.UserRepository

@Service
class UserCacheService(
    private val userRepository: UserRepository
) {
    @CachePut(key = "#user.id", value = ["user.id"])
    fun save(user: UserModel)
    {
        userRepository.save(user)
    }
}