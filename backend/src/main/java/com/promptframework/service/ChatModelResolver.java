package com.promptframework.service;

import dev.langchain4j.model.chat.ChatModel;

/**
 * 按一次评测请求声明的供应商和模型解析客户端，避免运行参数与实际模型脱节。
 */
@FunctionalInterface
public interface ChatModelResolver {

    ChatModel resolve(String provider, String modelName);
}
