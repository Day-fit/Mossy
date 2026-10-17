package pl.dayfit.mossykeysync.event

import com.fasterxml.jackson.annotation.JsonIgnore
import java.util.UUID

data class KeySyncEvent(
    val receiverId: UUID,
    val result: Result,
    @JsonIgnore val throwable: Throwable? = null,
) {
    val errorMessage: String? = throwable?.message

    enum class Result {
        SUCCESS,
        FAILED,
    }
}