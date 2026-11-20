import { realApi } from './realApi'
import { mockApi } from '../mocks/mockApi'

export const isMockMode = import.meta.env.DEV && String(import.meta.env.VITE_USE_MOCK_API).toLowerCase() === 'true'
export const api = isMockMode ? mockApi : realApi

export async function getAllMatrices() {
  const content = []
  let page = 0
  let result
  do {
    result = await api.getMatrices({ page, size: 100 })
    content.push(...result.content)
    page++
  } while (page < result.totalPages && result.content.length > 0)
  return { content }
}

export async function getAllPapers(matrixId) {
  const content = []
  let page = 0
  let result
  do {
    result = await api.getPapers({ matrixId, page, size: 100 })
    content.push(...result.content)
    page++
  } while (page < result.totalPages && result.content.length > 0)
  return { content }
}
