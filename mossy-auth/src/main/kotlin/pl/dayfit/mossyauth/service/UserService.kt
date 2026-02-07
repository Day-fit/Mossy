package pl.dayfit.mossyauth.service

import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import pl.dayfit.mossyauth.dto.request.RegisterUserRequestDto
import pl.dayfit.mossyauth.model.UserModel
import pl.dayfit.mossyauth.repository.UserRepository
import pl.dayfit.mossyauth.service.cache.UserCacheService
import pl.dayfit.mossyauth.type.AuthProvider

@Service
class UserService(
    private val userCacheService: UserCacheService,
    private val passwordEncoder: PasswordEncoder
) {
    fun register(requestDto: RegisterUserRequestDto)
    {
        //Password cannot be null, so a result of encoding is not null as well
        val encodedPassword: String = passwordEncoder.encode(requestDto.password)!!

        val user = UserModel(
            username = requestDto.username,
            email = requestDto.email,
            password = encodedPassword,
            authProvider = AuthProvider.LOCAL,
            authorities = listOf("USER"),
            enabled = true,
            blocked = false
        )

        //TODO: create a email confirmation for account registration
        userCacheService.save(user)
    }
}