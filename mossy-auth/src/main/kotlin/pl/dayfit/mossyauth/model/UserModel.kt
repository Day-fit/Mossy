package pl.dayfit.mossyauth.model

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import pl.dayfit.mossyauth.type.AuthProvider
import java.util.UUID

@Entity
data class UserModel(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,
    @Column(unique = true)
    var username: String,
    var password: String?,
    @Column(unique = true)
    var email: String?,
    var authProvider: AuthProvider,
    var authorities: List<String>,
    var enabled: Boolean,
    var blocked: Boolean
)
