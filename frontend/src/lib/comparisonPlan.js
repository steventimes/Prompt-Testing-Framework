const clone = (value) => JSON.parse(JSON.stringify(value))

/**
 * 在发起网络请求前冻结对比矩阵，避免控件状态在异步完成后篡改结果标签。
 */
export function createComparisonPlan({
  leftVersion,
  rightVersion,
  provider,
  modelName,
  selectedSuiteId,
  testCases,
}) {
  const source = selectedSuiteId
    ? { testSuiteId: Number(selectedSuiteId) }
    : { testCases: clone(testCases || []) }
  const common = { aiProvider: provider, modelName, ...source }
  return {
    leftRequest: { promptVersionId: Number(leftVersion.id), ...common },
    rightRequest: { promptVersionId: Number(rightVersion.id), ...common },
    snapshot: {
      leftVersion: { id: leftVersion.id, versionNumber: leftVersion.versionNumber },
      rightVersion: { id: rightVersion.id, versionNumber: rightVersion.versionNumber },
      provider,
      modelName,
      testCaseCount: (testCases || []).length,
    },
  }
}
