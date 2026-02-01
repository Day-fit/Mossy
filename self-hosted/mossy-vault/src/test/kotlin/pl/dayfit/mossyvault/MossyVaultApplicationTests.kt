package pl.dayfit.mossyvault

import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Profile

@Profile("test")
@SpringBootTest
class MossyVaultApplicationTests {

    @Test
    fun contextLoads() {
    }

}
