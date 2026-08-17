package com.promptframework.service;

import dev.langchain4j.model.chat.ChatModel;

/**
 * 隔离第三方模型客户端构建细节，让解析、缓存和凭据校验可独立测试。
 */
@FunctionalInterface
public interface ChatModelFactory {

    ChatModel create(String provider, String modelName, String apiKey);
}
