import { average, clamp, ensureLeadingSlash } from './mockMath'
import { summarizeWorkspace } from './workspaceAnalytics'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'
const MOCK_MODE = import.meta.env.VITE_USE_MOCK !== 'false'

const PROMPTS_KEY = 'ptf_mock_prompts'
const TEST_RUNS_KEY = 'ptf_mock_test_runs'

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))

const nowIso = () => new Date().toISOString()

const createResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() {
    return data
  },
})

const seededPrompts = [
  {
    id: 1,
    name: 'Customer Support Assistant',
    description: 'Friendly troubleshooting assistant for SaaS onboarding questions.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    versions: [
      {
        id: 11,
        versionNumber: 1,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
        content: 'You are a helpful support assistant. Answer clearly and ask one follow-up question.',
      },
      {
        id: 12,
        versionNumber: 2,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        content: 'You are an expert support assistant. Diagnose root cause, provide steps, and include confidence.',
      },
    ],
  },
  {
    id: 2,
    name: 'Invoice Exception Triage',
    description: 'Classifies finance exceptions and drafts concise next-step recommendations for operators.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(),
    versions: [
      {
        id: 21,
        versionNumber: 1,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(),
        content: 'Classify the invoice exception by risk, explain the likely cause, and propose the next action.',
      },
      {
        id: 22,
        versionNumber: 2,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 16).toISOString(),
        content: 'Act as a finance operations reviewer. Return severity, root cause hypothesis, and action owner.',
      },
    ],
  },
  {
    id: 3,
    name: 'Sales Call Summarizer',
    description: '',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    versions: [
      {
        id: 31,
        versionNumber: 1,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        content: 'Summarize the sales call transcript into pain points, objections, and next steps.',
      },
    ],
  },
]

const readStorage = (key, fallback, storage = localStorage) => {
  try {
    const existing = storage.getItem(key)
    if (!existing) return fallback
    return JSON.parse(existing)
  } catch {
    return fallback
  }
}

const writeStorage = (key, value, storage = localStorage) => {
  storage.setItem(key, JSON.stringify(value))
}

const ensureSeedData = () => {
  const prompts = readStorage(PROMPTS_KEY, null)
  if (!prompts || prompts.length === 0) {
    writeStorage(PROMPTS_KEY, seededPrompts)
  }

  const testRuns = readStorage(TEST_RUNS_KEY, null, sessionStorage)
  if (!testRuns) {
    writeStorage(TEST_RUNS_KEY, [], sessionStorage)
  }
}

const renderMockAnswer = ({ promptContent, question }) => {
  const shortPrompt = promptContent.slice(0, 60)
  return `Mock response for: "${question || 'empty input'}"\n\nSummary: ${shortPrompt}${promptContent.length > 60 ? '…' : ''}\n\n- This is running in mock mode\n- Great for demos and UI validation\n- Configure VITE_USE_MOCK=false to use the real API`
}

const calcMetrics = () => ({
  responseTimeMs: Math.round(clamp(350 + Math.random() * 500, 350, 850)),
  qualityScore: Number(clamp(0.65 + Math.random() * 0.3, 0.65, 0.95).toFixed(2)),
  costUsd: Number(clamp(0.0003 + Math.random() * 0.003, 0.0003, 0.0033).toFixed(4)),
})

const mockFetch = async (path, options = {}) => {
  ensureSeedData()
  await delay(200)

  const method = (options.method || 'GET').toUpperCase()
  const body = options.body ? JSON.parse(options.body) : undefined
  const prompts = readStorage(PROMPTS_KEY, [], localStorage)
  const testRuns = readStorage(TEST_RUNS_KEY, [], sessionStorage)

  if (path === '/workspace/summary' && method === 'GET') {
    return createResponse(summarizeWorkspace(prompts))
  }

  if (path === '/prompts' && method === 'GET') {
    return createResponse(prompts)
  }

  if (path === '/prompts' && method === 'POST') {
    const nextPromptId = Math.max(0, ...prompts.map((p) => p.id)) + 1
    const prompt = {
      id: nextPromptId,
      name: body.name,
      description: body.description,
      createdAt: nowIso(),
      versions: [
        {
          id: nextPromptId * 100,
          versionNumber: 1,
          content: body.initialContent,
        },
      ],
    }

    writeStorage(PROMPTS_KEY, [...prompts, prompt])
    return createResponse(prompt, 201)
  }

  const promptMatch = path.match(/^\/prompts\/(\d+)$/)
  if (promptMatch && method === 'GET') {
    const promptId = Number(promptMatch[1])
    const prompt = prompts.find((item) => item.id === promptId)
    return prompt ? createResponse(prompt) : createResponse({ message: 'Not found' }, 404)
  }

  const createVersionMatch = path.match(/^\/prompts\/(\d+)\/versions$/)
  if (createVersionMatch && method === 'POST') {
    const promptId = Number(createVersionMatch[1])
    const nextPrompts = prompts.map((item) => {
      if (item.id !== promptId) return item
      const nextVersionNumber = item.versions.length + 1
      const nextVersionId = promptId * 100 + nextVersionNumber
      return {
        ...item,
        versions: [
          ...item.versions,
          {
            id: nextVersionId,
            versionNumber: nextVersionNumber,
            content: body.content,
          },
        ],
      }
    })
    writeStorage(PROMPTS_KEY, nextPrompts)
    return createResponse({ success: true }, 201)
  }

  if (path === '/quick-test' && method === 'POST') {
    const results = (body.testInputs || []).map((input) => {
      const metrics = calcMetrics()
      return {
        inputVariables: input,
        aiResponse: renderMockAnswer({ promptContent: body.promptContent, question: input.question }),
        ...metrics,
      }
    })

    return createResponse({
      id: Date.now(),
      status: 'COMPLETED',
      results,
      metrics: {
        averageResponseTimeMs: Math.round(average(results.map((item) => item.responseTimeMs))),
        averageQualityScore: Number(average(results.map((item) => item.qualityScore)).toFixed(2)),
      },
    })
  }

  if (path === '/test-runs' && method === 'POST') {
    const promptVersionId = Number(body.promptVersionId)
    const results = (body.testInputs || []).map((input) => {
      const metrics = calcMetrics()
      return {
        inputVariables: input,
        aiResponse: renderMockAnswer({ promptContent: `version-${promptVersionId}`, question: input.question }),
        ...metrics,
      }
    })

    const run = {
      id: Date.now(),
      promptVersionId,
      status: 'COMPLETED',
      startedAt: nowIso(),
      results,
      metrics: {
        averageResponseTimeMs: Math.round(average(results.map((item) => item.responseTimeMs))),
        averageQualityScore: Number(average(results.map((item) => item.qualityScore)).toFixed(2)),
      },
    }

    writeStorage(TEST_RUNS_KEY, [run, ...testRuns], sessionStorage)
    return createResponse(run, 201)
  }

  const historyMatch = path.match(/^\/test-runs\/version\/(\d+)$/)
  if (historyMatch && method === 'GET') {
    const versionId = Number(historyMatch[1])
    const history = testRuns.filter((run) => run.promptVersionId === versionId)
    return createResponse(history)
  }

  return createResponse({ message: `Mock endpoint not implemented: ${method} ${path}` }, 404)
}

export const buildApiUrl = (path) => `${API_BASE}${ensureLeadingSlash(path)}`

export const isMockMode = () => MOCK_MODE

export const apiFetch = (path, options = {}) => {
  if (MOCK_MODE) {
    return mockFetch(path, options)
  }
  return fetch(buildApiUrl(path), options)
}

export { API_BASE }
