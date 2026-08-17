CREATE TABLE IF NOT EXISTS prompts (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prompt_versions (
    id BIGSERIAL PRIMARY KEY,
    prompt_id BIGINT REFERENCES prompts(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    content TEXT NOT NULL,
    variables JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(prompt_id, version_number)
);

CREATE TABLE IF NOT EXISTS test_suites (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    cases JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_runs (
    id BIGSERIAL PRIMARY KEY,
    prompt_version_id BIGINT REFERENCES prompt_versions(id) ON DELETE CASCADE,
    test_suite_id BIGINT REFERENCES test_suites(id) ON DELETE SET NULL,
    ai_provider VARCHAR(50) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'RUNNING'
);

CREATE TABLE IF NOT EXISTS test_results (
    id BIGSERIAL PRIMARY KEY,
    test_run_id BIGINT REFERENCES test_runs(id) ON DELETE CASCADE,
    case_name VARCHAR(200),
    input_variables JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    error_code VARCHAR(80),
    error_message TEXT,
    ai_response TEXT,
    response_time_ms INT,
    token_count INT,
    cost_usd DECIMAL(10, 6),
    quality_score DECIMAL(4, 3),
    assertion_passed BOOLEAN,
    assertion_results JSONB NOT NULL DEFAULT '[]'::jsonb,
    privacy_risk_score DECIMAL(4, 3),
    privacy_flags JSONB,
    mcp_calls JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 已有开发库也能增量获得新字段；IF NOT EXISTS 让全新库和旧库共用同一迁移。
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS case_name VARCHAR(200);
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS assertion_passed BOOLEAN;
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS assertion_results JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE test_results ALTER COLUMN quality_score TYPE DECIMAL(4, 3);
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS test_suite_id BIGINT REFERENCES test_suites(id) ON DELETE SET NULL;

-- 旧初始化脚本没有为 test_runs 配置级联，删除 Prompt 时会被历史运行阻塞。
ALTER TABLE test_runs DROP CONSTRAINT IF EXISTS test_runs_prompt_version_id_fkey;
ALTER TABLE test_runs
    ADD CONSTRAINT test_runs_prompt_version_id_fkey
    FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_prompt_version ON test_runs(prompt_version_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_test_suite ON test_runs(test_suite_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_run ON test_results(test_run_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_status_started ON test_runs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_suites_updated ON test_suites(updated_at DESC);

INSERT INTO prompts (name, description)
SELECT 'Sample Prompt', 'A test prompt for development'
WHERE NOT EXISTS (SELECT 1 FROM prompts);

INSERT INTO prompt_versions (prompt_id, version_number, content)
SELECT id, 1, 'You are a helpful assistant. Please help with: {task}'
FROM prompts
WHERE NOT EXISTS (SELECT 1 FROM prompt_versions)
ORDER BY id
LIMIT 1;
