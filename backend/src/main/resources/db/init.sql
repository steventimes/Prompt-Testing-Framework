CREATE TABLE prompts (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE prompt_versions (
    id BIGSERIAL PRIMARY KEY,
    prompt_id BIGINT REFERENCES prompts(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    content TEXT NOT NULL,
    variables JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(prompt_id, version_number)
);

CREATE TABLE test_runs (
    id BIGSERIAL PRIMARY KEY,
    prompt_version_id BIGINT REFERENCES prompt_versions(id),
    ai_provider VARCHAR(50) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'RUNNING'
);

CREATE TABLE test_results (
    id BIGSERIAL PRIMARY KEY,
    test_run_id BIGINT REFERENCES test_runs(id) ON DELETE CASCADE,
    input_variables JSONB,
    ai_response TEXT,
    response_time_ms INT,
    token_count INT,
    cost_usd DECIMAL(10, 6),
    quality_score DECIMAL(3, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
CREATE INDEX idx_test_runs_prompt_version ON test_runs(prompt_version_id);
CREATE INDEX idx_test_results_test_run ON test_results(test_run_id);

INSERT INTO prompts (name, description) VALUES 
('Sample Prompt', 'A test prompt for development');

INSERT INTO prompt_versions (prompt_id, version_number, content) VALUES 
(1, 1, 'You are a helpful assistant. Please help with: {task}');