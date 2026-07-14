package pl.dayfit.mossyauth.controller

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import pl.dayfit.mossyauth.service.JwksService

@RestController
@RequestMapping("/.well-known")
class JwksController(
    private val jwksService: JwksService
) {
    @GetMapping("/jwks.json")
    fun getJwks(): ResponseEntity<Map<String, Any>> {
        return ResponseEntity.ok(
            jwksService.getJwks()
        )
    }
}