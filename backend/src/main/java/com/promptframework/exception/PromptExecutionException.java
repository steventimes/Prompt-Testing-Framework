package com.promptframework.exception;

public class PromptExecutionException extends RuntimeException {

    private final String code;

    public PromptExecutionException(String code, String message) {
        super(message);
        this.code = code;
    }

    public PromptExecutionException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
