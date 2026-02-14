package pl.dayfit.mossyauthstarter.auth.principal

import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.userdetails.UserDetails
import java.util.UUID

class UserDetailsImpl(
    private val username: String,
    private val password: String?,
    val userId: UUID,
    private val grantedAuthorities: Collection<GrantedAuthority>
) : UserDetails {
    override fun getAuthorities(): Collection<GrantedAuthority> {
        return grantedAuthorities
    }

    override fun getPassword(): String? {
        return password
    }

    override fun getUsername(): String {
        return username
    }
}