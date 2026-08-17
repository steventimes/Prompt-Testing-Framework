package com.promptframework.exception;

public class ResourceNotFoundException extends RuntimeException {

    private final String resource;
    private final Object resourceId;

    public ResourceNotFoundException(String resource, Object resourceId) {
        super(resource + " not found: " + resourceId);
        this.resource = resource;
        this.resourceId = resourceId;
    }

    public String getResource() {
        return resource;
    }

    public Object getResourceId() {
        return resourceId;
    }
}
