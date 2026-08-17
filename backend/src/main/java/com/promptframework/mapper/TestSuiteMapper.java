package com.promptframework.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.promptframework.model.entity.TestSuite;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface TestSuiteMapper extends BaseMapper<TestSuite> {
}
