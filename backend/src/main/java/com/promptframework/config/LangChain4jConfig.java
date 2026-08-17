package com.promptframework.config;

import com.promptframework.service.ChatModelFactory;
import dev.langchain4j.model.anthropic.AnthropicChatModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LangChain4jConfig {

    @Bean
    public ChatModelFactory chatModelFactory() {
        return (provider, modelName, apiKey) -> switch (provider) {
            case "openai" -> OpenAiChatModel.builder()
                    .apiKey(apiKey)
                    .modelName(modelName)
                    .build();
            case "anthropic" -> AnthropicChatModel.builder()
                    .apiKey(apiKey)
                    .modelName(modelName)
                    .build();
            // ConfiguredChatModelResolver 已先校验供应商，这里保留防御性边界。
            default -> throw new IllegalArgumentException("Unsupported AI provider: " + provider);
        };
    }
}
