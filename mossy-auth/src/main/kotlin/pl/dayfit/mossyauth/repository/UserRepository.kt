package pl.dayfit.mossyauth.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import pl.dayfit.mossyauth.model.UserModel
import java.util.Optional
import java.util.UUID

@Repository
interface UserRepository : JpaRepository<UserModel, UUID> {
    fun findByUsername(username: String): Optional<UserModel>
    fun findByEmail(email: String): Optional<UserModel>
    fun existsByUsernameAndEmail(username: String, email: String): Boolean
}