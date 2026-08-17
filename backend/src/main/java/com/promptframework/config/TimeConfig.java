package com.promptframework.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TimeConfig {

    /**
     * 所有治理和审计时间统一使用 UTC，避免部署节点时区造成判定差异。
     */
    @Bean
    public Clock applicationClock() {
        return Clock.systemUTC();
    }
}
