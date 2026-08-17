package com.promptframework.service;

import com.promptframework.exception.PromptExecutionException;
import dev.langchain4j.model.chat.ChatModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
public class ConfiguredChatModelResolver implements ChatModelResolver {

    private static final int MAX_CACHED_MODELS = 32;

    private final ChatModelFactory chatModelFactory;
    private final Map<String, String> apiKeys;
    private final Map<ModelCoordinates, ChatModel> models = new LinkedHashMap<>(16, 0.75F, true);

    public ConfiguredChatModelResolver(
            ChatModelFactory chatModelFactory,
            @Value("${ai.openai.api-key:}") String openAiApiKey,
            @Value("${ai.anthropic.api-key:}") String anthropicApiKey
    ) {
        this.chatModelFactory = chatModelFactory;
        this.apiKeys = Map.of(
                "openai", normalizeKey(openAiApiKey),
                "anthropic", normalizeKey(anthropicApiKey)
        );
    }

    @Override
    public ChatModel resolve(String provider, String modelName) {
        String normalizedProvider = normalizeProvider(provider);
        String normalizedModel = modelName == null ? "" : modelName.trim();
        if (normalizedModel.isEmpty()) {
            throw new PromptExecutionException("MODEL_NAME_INVALID", "模型名称不能为空");
        }

        String apiKey = apiKeys.get(normalizedProvider);
        if (apiKey == null) {
            throw new PromptExecutionException(
                    "PROVIDER_NOT_SUPPORTED",
                    "不支持的模型供应商: " + normalizedProvider
            );
        }
        if (apiKey.isEmpty()) {
            throw new PromptExecutionException(
                    "PROVIDER_NOT_CONFIGURED",
                    "模型供应商未配置凭据: " + normalizedProvider
            );
        }

        ModelCoordinates coordinates = new ModelCoordinates(normalizedProvider, normalizedModel);
        synchronized (models) {
            ChatModel cached = models.get(coordinates);
            if (cached != null) {
                return cached;
            }
            ChatModel created = chatModelFactory.create(normalizedProvider, normalizedModel, apiKey);
            models.put(coordinates, created);
            evictOldestClient();
            return created;
        }
    }

    private void evictOldestClient() {
        if (models.size() <= MAX_CACHED_MODELS) {
            return;
        }
        var iterator = models.entrySet().iterator();
        iterator.next();
        iterator.remove();
    }

    private String normalizeProvider(String provider) {
        return provider == null ? "" : provider.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeKey(String apiKey) {
        return apiKey == null ? "" : apiKey.trim();
    }

    private record ModelCoordinates(String provider, String modelName) {
    }
}
