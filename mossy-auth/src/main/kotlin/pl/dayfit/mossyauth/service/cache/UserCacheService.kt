package pl.dayfit.mossyauth.service.cache

import org.springframework.cache.annotation.CacheEvict
import org.springframework.cache.annotation.CachePut
import org.springframework.cache.annotation.Cacheable
import org.springframework.stereotype.Service
import pl.dayfit.mossyauth.model.UserModel
import pl.dayfit.mossyauth.repository.UserRepository
import java.util.UUID

@Service
class UserCacheService(
    private val userRepository: UserRepository
) {
    @CachePut(key = "#user.id", value = ["user.id"])
    fun save(user: UserModel)
    {
        userRepository.save(user)
    }

    @Cacheable(key = "#userId", value = ["user.id"])
    fun get(userId: UUID): UserModel
    {
        return userRepository.findById(userId)
            .orElseThrow { throw NoSuchElementException("User not found") }
    }

    @CacheEvict(key = "#userId", value = ["user.id"])
    fun delete(userId: UUID) {
        userRepository.deleteById(userId)
    }
}