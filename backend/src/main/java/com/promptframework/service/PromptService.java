package com.promptframework.service;

import com.promptframework.exception.ResourceNotFoundException;
import com.promptframework.mapper.PromptMapper;
import com.promptframework.mapper.PromptVersionMapper;
import com.promptframework.model.dto.PromptCreateRequest;
import com.promptframework.model.dto.PromptResponse;
import com.promptframework.model.dto.PromptUpdateRequest;
import com.promptframework.model.entity.Prompt;
import com.promptframework.model.entity.PromptVersion;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PromptService {

    private final PromptMapper promptMapper;
    private final PromptVersionMapper promptVersionMapper;

    @Transactional
    public PromptResponse createPrompt(PromptCreateRequest request) {
        Prompt prompt = new Prompt();
        prompt.setName(request.getName().trim());
        prompt.setDescription(normalizeDescription(request.getDescription()));
        promptMapper.insert(prompt);

        PromptVersion version = new PromptVersion();
        version.setPromptId(prompt.getId());
        version.setVersionNumber(1);
        version.setContent(request.getInitialContent().trim());
        promptVersionMapper.insert(version);

        return buildPromptResponse(prompt);
    }

    @Transactional
    public PromptVersion createNewVersion(Long promptId, String content) {
        // 锁定父 Prompt 行，使同一 Prompt 的版本号分配在并发事务中串行化。
        Prompt prompt = promptMapper.findByIdForUpdate(promptId);
        if (prompt == null) {
            throw new ResourceNotFoundException("Prompt", promptId);
        }
        Integer nextVersion = promptVersionMapper.getNextVersionNumber(promptId);

        PromptVersion version = new PromptVersion();
        version.setPromptId(promptId);
        version.setVersionNumber(nextVersion);
        version.setContent(content.trim());
        promptVersionMapper.insert(version);

        return version;
    }

    public PromptResponse getPromptById(Long id) {
        Prompt prompt = promptMapper.findById(id);
        if (prompt == null) {
            throw new ResourceNotFoundException("Prompt", id);
        }
        return buildPromptResponse(prompt);
    }

    public PromptVersion getVersion(Long versionId) {
        PromptVersion version = promptVersionMapper.findById(versionId);
        if (version == null) {
            throw new ResourceNotFoundException("PromptVersion", versionId);
        }
        return version;
    }

    @Transactional
    public PromptResponse updatePrompt(Long id, PromptUpdateRequest request) {
        Prompt prompt = promptMapper.findById(id);
        if (prompt == null) {
            throw new ResourceNotFoundException("Prompt", id);
        }
        prompt.setName(request.getName().trim());
        prompt.setDescription(normalizeDescription(request.getDescription()));
        promptMapper.update(prompt);
        return buildPromptResponse(prompt);
    }

    @Transactional
    public void deletePrompt(Long id) {
        if (promptMapper.findById(id) == null) {
            throw new ResourceNotFoundException("Prompt", id);
        }
        promptMapper.deleteById(id);
    }

    public List<PromptResponse> getAllPrompts() {
        return promptMapper.findAll().stream()
                .map(this::buildPromptResponse)
                .toList();
    }

    private PromptResponse buildPromptResponse(Prompt prompt) {
        PromptResponse response = new PromptResponse();
        response.setId(prompt.getId());
        response.setName(prompt.getName());
        response.setDescription(prompt.getDescription());
        response.setCreatedAt(prompt.getCreatedAt());
        response.setUpdatedAt(prompt.getUpdatedAt());

        List<PromptVersion> versions = promptVersionMapper.findByPromptId(prompt.getId());
        response.setVersions(versions);

        return response;
    }
    private String normalizeDescription(String description) {
        return description == null ? "" : description.trim();
    }

}
