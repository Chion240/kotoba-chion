// ai-analysis · useAiProfiles（AI 档案 CRUD，供给当前会话配置）。
// 首次种 DeepSeek 默认档案（apiKey 空，用户自填）；每次改都整体 saveAiProfiles 覆盖写（CR-3）。
// 支持自定义：baseURL/apiKey/model/systemPrompt/temperature 皆可编辑，可多档案增删。
import { useCallback, useEffect, useState } from 'react'
import type { AiProfile, AiProfilesState } from '../../../../shared/contracts'

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// DeepSeek 默认档案（OpenAI 兼容）。apiKey 留空由用户填。
function seedDefault(): AiProfilesState {
  const id = uid()
  return {
    activeId: id,
    profiles: [
      {
        id,
        name: 'DeepSeek',
        baseURL: 'https://api.deepseek.com',
        apiKey: '',
        model: 'deepseek-chat',
        systemPrompt:
          '你是日语学习助手。用户会发来日文单词或句子，请分析其含义、读音、语法结构与用法，用中文简洁讲解。',
        temperature: 1.0
      }
    ]
  }
}

export type UseAiProfiles = {
  state: AiProfilesState
  activeProfile: AiProfile | null
  ready: boolean
  setActive: (id: string) => void
  addProfile: () => void
  updateProfile: (id: string, patch: Partial<AiProfile>) => void
  deleteProfile: (id: string) => void
}

export function useAiProfiles(): UseAiProfiles {
  const [state, setState] = useState<AiProfilesState>({ profiles: [], activeId: '' })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    void window.chion.getAiProfiles().then((loaded) => {
      if (!alive) return
      const next = loaded.profiles.length > 0 ? loaded : seedDefault()
      if (loaded.profiles.length === 0) void window.chion.saveAiProfiles(next)
      setState(next)
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  // 整体覆盖写 + 本地同步（单一真值）。
  const persist = useCallback((next: AiProfilesState) => {
    setState(next)
    void window.chion.saveAiProfiles(next)
  }, [])

  const setActive = useCallback(
    (id: string) => persist({ ...state, activeId: id }),
    [state, persist]
  )

  const addProfile = useCallback(() => {
    const p: AiProfile = {
      id: uid(),
      name: '新档案',
      baseURL: 'https://api.deepseek.com',
      apiKey: '',
      model: 'deepseek-chat',
      systemPrompt: '',
      temperature: 1.0
    }
    persist({ profiles: [...state.profiles, p], activeId: p.id })
  }, [state, persist])

  const updateProfile = useCallback(
    (id: string, patch: Partial<AiProfile>) => {
      persist({
        ...state,
        profiles: state.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p))
      })
    },
    [state, persist]
  )

  // 删不到空（至少留一个，保证 activeProfile 恒存在，send 不用判空）。
  const deleteProfile = useCallback(
    (id: string) => {
      if (state.profiles.length <= 1) return
      const profiles = state.profiles.filter((p) => p.id !== id)
      const activeId = state.activeId === id ? profiles[0].id : state.activeId
      persist({ profiles, activeId })
    },
    [state, persist]
  )

  const activeProfile =
    state.profiles.find((p) => p.id === state.activeId) ?? state.profiles[0] ?? null

  return { state, activeProfile, ready, setActive, addProfile, updateProfile, deleteProfile }
}
