package pl.dayfit.mossypassword.service.exception

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ResponseStatus

@ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
class VaultNotRespondedException(message: String) : RuntimeException(message)