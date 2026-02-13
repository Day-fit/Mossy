package pl.dayfit.mossyauth.controller

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossyauth.dto.response.GenericServerResponseDto
import pl.dayfit.mossyauth.dto.response.UserDetailsResponseDto
import pl.dayfit.mossyauth.service.UserService
import java.util.UUID

@RestController
@RequestMapping("/user")
class UserController(
    private val userService: UserService
) {
    @GetMapping("/details")
    fun getUserDetails(@AuthenticationPrincipal userId: UUID): ResponseEntity<UserDetailsResponseDto>
    {
        return ResponseEntity.ok(
            userService.getDetails(userId)
        )
    }

    @DeleteMapping("/{id}")
    fun deleteUser(@PathVariable id: UUID): ResponseEntity<GenericServerResponseDto>
    {
        userService.deleteUser(id)

        return ResponseEntity.ok(
            GenericServerResponseDto("User deleted successfully")
        )
    }
}