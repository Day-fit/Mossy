package pl.dayfit.mossypassword.controller.advice

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import pl.dayfit.mossypassword.dto.response.ServerResponseDto
import pl.dayfit.mossypassword.service.exception.VaultNotConnectedException
import pl.dayfit.mossypassword.service.exception.VaultNotFoundException

@RestControllerAdvice
class GlobalControllerAdvice {

    @ExceptionHandler(VaultNotFoundException::class)
    fun handleVaultNotFound(exception: VaultNotFoundException): ResponseEntity<ServerResponseDto> {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ServerResponseDto(exception.message ?: "Vault does not exist"))
    }

    @ExceptionHandler(VaultNotConnectedException::class)
    fun handleVaultNotConnected(exception: VaultNotConnectedException): ResponseEntity<ServerResponseDto> {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(ServerResponseDto(exception.message ?: "Vault is not connected"))
    }
}
