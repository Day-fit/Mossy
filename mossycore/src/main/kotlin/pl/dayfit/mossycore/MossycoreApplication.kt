package pl.dayfit.mossycore

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class MossycoreApplication

fun main(args: Array<String>) {
    runApplication<MossycoreApplication>(*args)
}
