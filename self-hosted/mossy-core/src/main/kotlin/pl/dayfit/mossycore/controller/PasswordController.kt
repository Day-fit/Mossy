package pl.dayfit.mossycore.controller

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossycore.service.PasswordGenerationService

@RestController("/password")
class PasswordController(
    private val passwordGenerationService: PasswordGenerationService
) {
    @PostMapping("/generate")
    fun generatePassword(): ResponseEntity<String>
    {
        return ResponseEntity.ok(passwordGenerationService.generatePassword())
    }
}