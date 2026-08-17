package com.promptframework.mapper;

import com.promptframework.model.entity.Prompt;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface PromptMapper {

    // 数据库生成主键后由 MyBatis 回填到实体。
    void insert(Prompt prompt);

    Prompt findById(@Param("id") Long id);

    Prompt findByIdForUpdate(@Param("id") Long id);

    List<Prompt> findAll();

    void update(Prompt prompt);

    void deleteById(@Param("id") Long id);
}
