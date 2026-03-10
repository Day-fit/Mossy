package pl.dayfit.mossypassword.controller

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossypassword.dto.response.VaultRegistrationResponseDto
import pl.dayfit.mossypassword.dto.response.VaultStatusResponseDto
import pl.dayfit.mossypassword.service.VaultRegistrationService
import pl.dayfit.mossypassword.repository.VaultRepository

@RestController
@RequestMapping("/vault")
class VaultController(
    private val vaultRegistrationService: VaultRegistrationService,
    private val vaultRepository: VaultRepository
) {
    @PostMapping("/register")
    fun register(): ResponseEntity<VaultRegistrationResponseDto> {
        return ResponseEntity.ok(vaultRegistrationService.register())
    }

    @GetMapping("/statuses")
    fun statuses(): ResponseEntity<List<VaultStatusResponseDto>> {
        return ResponseEntity.ok(
            vaultRepository.findAll().map {
                VaultStatusResponseDto(
                    vaultId = it.id!!,
                    vaultName = it.vaultName,
                    isOnline = it.isOnline
                )
            }
        )
    }
}
