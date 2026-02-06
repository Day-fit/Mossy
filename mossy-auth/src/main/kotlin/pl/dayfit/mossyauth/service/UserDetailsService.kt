package pl.dayfit.mossyauth.service

import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.core.userdetails.UsernameNotFoundException
import org.springframework.stereotype.Service
import pl.dayfit.mossyauth.model.UserModel
import pl.dayfit.mossyauth.repository.UserRepository
import pl.dayfit.mossyauthstarter.auth.principal.UserDetailsImpl

@Service
class UserDetailsService(
    private val userRepository: UserRepository
) : UserDetailsService {
    /**
     * Loads the user details by the provided username or email address. Depending on whether the input contains
     * an "@" symbol, the method delegates the lookup to either the `loadByUsername` method
     * (for username-based searches) or the `loadByEmail` method (for email-based searches).
     *
     * @param username the username or email address used to identify the user
     * @return an instance of `UserDetails` containing the user's information
     * @throws UsernameNotFoundException if no user is found for the given username or email
     */
    override fun loadUserByUsername(username: String): UserDetails {
        val user = if(username.contains("@")) loadByUsername(username) else loadByEmail(username)

        val authorities = user.authorities.map { SimpleGrantedAuthority(it) }

        return UserDetailsImpl(
            username,
            user.password,
            user.id!!,
            authorities
            )
    }

    fun loadByUsername(username: String): UserModel
    {
        return userRepository.findByUsername(username)
            .orElseThrow { throw UsernameNotFoundException("User not found") }
    }

    fun loadByEmail(email: String): UserModel
    {
        return userRepository.findByUsername(email)
            .orElseThrow { UsernameNotFoundException("User not found") }
    }
}