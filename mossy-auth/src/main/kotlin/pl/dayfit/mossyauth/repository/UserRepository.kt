package pl.dayfit.mossyauth.repository

import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import pl.dayfit.mossyauth.model.UserModel
import java.util.Optional
import java.util.UUID

@Repository
interface UserRepository : JpaRepository<UserModel, UUID> {
    fun findByUsername(username: String): Optional<UserModel>
    fun findByEmail(email: String): Optional<UserModel>
    fun existsByUsernameOrEmail(username: String, email: String): Boolean
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UserModel u where u.id = :id")
    fun findLockedById(@Param("id") id: UUID): Optional<UserModel>
}
