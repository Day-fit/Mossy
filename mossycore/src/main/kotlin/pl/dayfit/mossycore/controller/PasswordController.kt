package pl.dayfit.mossycore.controller

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossycore.dto.request.SavePasswordRequestDto
import pl.dayfit.mossycore.dto.response.ServerResponseDto
import pl.dayfit.mossycore.service.VaultCommunicationService

@RestController("/password")
class PasswordController(
    private val vaultCommunicationService: VaultCommunicationService
) {
    @PostMapping("/save")
    fun savePassword(requestDto: SavePasswordRequestDto): ResponseEntity<ServerResponseDto>
    {
        vaultCommunicationService.savePassword(requestDto)

        return ResponseEntity.ok(
            ServerResponseDto("Password saved successfully")
        )
    }
}