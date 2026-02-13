package pl.dayfit.mossyjwksevents.event;

import java.time.Instant;
import java.util.Map;

public record JwkSetUpdatedEvent(
        Map<String, Object> jwkSetJsonObject,
        Instant timestamp
) {
}