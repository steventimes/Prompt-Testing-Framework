package com.promptframework.service;

import com.promptframework.mapper.PromptMapper;
import com.promptframework.mapper.PromptVersionMapper;
import com.promptframework.model.dto.PromptCreateRequest;
import com.promptframework.model.dto.PromptResponse;
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
        prompt.setName(request.getName());
        prompt.setDescription(request.getDescription());
        promptMapper.insert(prompt);

        PromptVersion version = new PromptVersion();
        version.setPromptId(prompt.getId());
        version.setVersionNumber(1);
        version.setContent(request.getInitialContent());
        promptVersionMapper.insert(version);

        return buildPromptResponse(prompt);
    }

    @Transactional
    public PromptVersion createNewVersion(Long promptId, String content) {
        Integer nextVersion = promptVersionMapper.getNextVersionNumber(promptId);

        PromptVersion version = new PromptVersion();
        version.setPromptId(promptId);
        version.setVersionNumber(nextVersion);
        version.setContent(content);
        promptVersionMapper.insert(version);

        return version;
    }

    public PromptResponse getPromptById(Long id) {
        Prompt prompt = promptMapper.findById(id);
        if (prompt == null) {
            throw new RuntimeException("Prompt not found: " + id);
        }
        return buildPromptResponse(prompt);
    }

    public PromptVersion getVersion(Long versionId) {
        PromptVersion version = promptVersionMapper.findById(versionId);
        if (version == null) {
            throw new RuntimeException("Version not found: " + versionId);
        }
        return version;
    }

    public List<Prompt> getAllPrompts() {
        return promptMapper.findAll();
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
}
