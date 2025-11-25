package com.promptframework.mapper;

import com.promptframework.model.entity.TestRun;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface TestRunMapper {

    void insert(TestRun testRun);

    TestRun findById(@Param("id") Long id);

    List<TestRun> findByPromptVersionId(@Param("promptVersionId") Long promptVersionId);

    void updateCompletion(@Param("id") Long id,
            @Param("status") String status);
}
