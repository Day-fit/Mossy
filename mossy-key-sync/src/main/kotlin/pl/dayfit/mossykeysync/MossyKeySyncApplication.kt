package pl.dayfit.mossykeysync

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class MossyDeviceApplication

fun main(args: Array<String>) {
    runApplication<MossyDeviceApplication>(*args)
}
