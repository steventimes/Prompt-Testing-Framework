package com.promptframework;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching
public class PromptTestingApplication {

    public static void main(String[] args) {
        SpringApplication.run(PromptTestingApplication.class, args);
    }
}
