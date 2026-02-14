package pl.dayfit.mossyjwks.service;

import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import pl.dayfit.mossyjwksevents.event.JwkSetUpdatedEvent;

import java.text.ParseException;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Stream;

@Service
public class JwksService {
    private final RedisTemplate<String, Object> redisTemplate;
    private final Logger logger = LoggerFactory.getLogger(JwksService.class);
    private final RabbitTemplate rabbitTemplate;
    private static final String JWKS_FANOUT_EXCHANGE = "fanout.jwks.exchange";

    public JwksService(RedisTemplate<String, Object> redisTemplate, RabbitTemplate rabbitTemplate) {
        this.redisTemplate = redisTemplate;
        this.rabbitTemplate = rabbitTemplate;
    }

    /**
     * Retrieves the current JSON Web Key Set (JWKSet) from the Redis key store.
     * The method gathers all valid JWK entries available in Redis, parses them
     * into JWK objects, and constructs a JWKSet containing these keys.
     *
     * @return the current JWKSet containing all valid JWK entries stored in the Redis key store.
     *         Returns an empty JWKSet if no valid keys are found.
     */
    public JWKSet getCurrentJwkSet() {
        final List<String> indexes = redisTemplate.opsForSet()
                .members("jwk:index")
                .stream()
                .filter(index -> index instanceof String)
                .map(Object::toString)
                .filter(
                    index -> {
                        Object value = redisTemplate.opsForValue()
                                .get("jwk:" + index);

                        return value != null;
                    }
                )
                .toList();

        final List<JWK> jwkList = indexes
                .stream()
                .map(index -> redisTemplate.opsForValue().get("jwk:" + index))
                .filter(jwk -> jwk instanceof String)
                .map(String.class::cast)
                .flatMap( jwk -> {
                    try {
                        return Stream.of(JWK.parse(jwk));
                    } catch (ParseException ex) {
                        return Stream.empty();
                    }
                })
                .toList();

        return new JWKSet(jwkList);
    }

    /**
     * Adds a new JSON Web Key (JWK) to the Redis-backed key store.
     *
     * @param newKey the new JWK to be uploaded and stored in the Redis key list.
     */
    public void uploadNewKey(JWK newKey) {
        final String kid = newKey.getKeyID();

        logger.info("Uploading new JWK to Redis key store. {}", kid);
        long expiresAt = Duration.between(
                Instant.now(),
                newKey.getExpirationTime().toInstant()
        ).toMillis();

        if (expiresAt <= 0) {
            logger.warn("Received JWK with expiration time in the past.");
            return;
        }

        redisTemplate.opsForValue()
                .set("jwk:" + kid, newKey.toJSONString(), Duration.of(expiresAt, ChronoUnit.MILLIS));

        redisTemplate.opsForSet()
                .add("jwk:index", kid);

        notifyRabbitMQ();
    }

    private void notifyRabbitMQ() {
        rabbitTemplate.convertAndSend(
                JWKS_FANOUT_EXCHANGE,
                "",
                new JwkSetUpdatedEvent(
                        getCurrentJwkSet().toJSONObject(),
                        Instant.now()
                )
        );
    }
}
