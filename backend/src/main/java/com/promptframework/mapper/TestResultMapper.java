package com.promptframework.mapper;

import com.promptframework.model.entity.TestResult;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface TestResultMapper {

    void insert(TestResult testResult);

    TestResult findById(@Param("id") Long id);

    List<TestResult> findByTestRunId(@Param("testRunId") Long testRunId);
}
