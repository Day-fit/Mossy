package pl.dayfit.mossyjwks.controller;

import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pl.dayfit.mossyjwks.exception.JwkNotReadableException;
import pl.dayfit.mossyjwks.service.JwksService;

import java.text.ParseException;
import java.util.Map;

@RestController
@RequestMapping("/.well-known")
public class WellKnownController {
    private final JwksService jwksService;

    public WellKnownController(JwksService jwksService) {
        this.jwksService = jwksService;
    }

    @GetMapping("/jwks.json")
    public ResponseEntity<Map<String, Object>> getJwkSet()
    {
        JWKSet set = jwksService.getCurrentJwkSet();

        return ResponseEntity.ok(
                set.toJSONObject()
        );
    }

    //TODO: before release, please add authentication to this endpoint (e. g mTLS)
    /**
     * Uploads a new JSON Web Key (JWK) and adds it to the Redis-backed key store.
     *
     * @param newKeyRaw the new JWK to be uploaded and stored in the key store.
     * @return a {@link ResponseEntity} with an empty body and an HTTP status of 200 OK.
     */
    @PutMapping("/jwks.json/add")
    public ResponseEntity<Void> addJwk(@RequestBody String newKeyRaw)
    {
        try {
            final JWK jwk = JWK.parse(newKeyRaw);
            jwksService.uploadNewKey(jwk);
        } catch (ParseException ex) {
            throw new JwkNotReadableException("Invalid JWK format");
        }

        return ResponseEntity.ok()
                .build();
    }
}
