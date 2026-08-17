ALTER TABLE test_runs
    ADD COLUMN IF NOT EXISTS dataset_fingerprint VARCHAR(64);

-- 历史运行允许为空；新写入的非空值必须是小写 SHA-256 十六进制摘要。
ALTER TABLE test_runs
    DROP CONSTRAINT IF EXISTS chk_test_runs_dataset_fingerprint;
ALTER TABLE test_runs
    ADD CONSTRAINT chk_test_runs_dataset_fingerprint
    CHECK (dataset_fingerprint IS NULL OR dataset_fingerprint ~ '^[0-9a-f]{64}$');
