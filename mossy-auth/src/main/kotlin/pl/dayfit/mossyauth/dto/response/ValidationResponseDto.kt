package pl.dayfit.mossyauth.dto.response

data class ValidationResponseDto(
    val errors: List<ValidationResult>
){
    data class ValidationResult(
        val field: String,
        val message: String
    )
}