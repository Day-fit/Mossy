package pl.dayfit.mossykeysync.dto.messaging

data class PeerResponseMessage (
    val status: Status,
) {
    enum class Status {
        SUCCESS,
        FAILED
    }
}