package com.promptframework.mapper;

import com.promptframework.model.entity.PromptVersion;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface PromptVersionMapper {

    void insert(PromptVersion promptVersion);

    PromptVersion findById(@Param("id") Long id);

    List<PromptVersion> findByPromptId(@Param("promptId") Long promptId);

    PromptVersion findLatestByPromptId(@Param("promptId") Long promptId);

    Integer getNextVersionNumber(@Param("promptId") Long promptId);
}
