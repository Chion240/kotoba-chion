// 声音档案模块级 store：Reader 与设置页共享同一快照，修改后下一次合成立即生效。
import { useEffect, useSyncExternalStore } from 'react'
import type { VoiceProfile, VoiceProfilesState } from '../../../../shared/contracts'

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function seedDefault(): VoiceProfilesState {
  const id = uid()
  return {
    activeId: id,
    profiles: [
      {
        id,
        name: '本地 SoVITS',
        engine: 'sovits',
        baseURL: 'http://127.0.0.1:9880',
        refAudioPath: '',
        promptText: '',
        promptLang: 'ja',
        textLang: 'ja',
        speedFactor: 1.0
      }
    ]
  }
}

export type VoiceProfilesSnapshot = {
  state: VoiceProfilesState
  activeProfile: VoiceProfile | null
  ready: boolean
}

let snapshot: VoiceProfilesSnapshot = {
  state: { profiles: [], activeId: '' },
  activeProfile: null,
  ready: false
}
let loadPromise: Promise<void> | null = null
const listeners = new Set<() => void>()

function activeOf(state: VoiceProfilesState): VoiceProfile | null {
  return state.profiles.find((profile) => profile.id === state.activeId) ?? state.profiles[0] ?? null
}

function replaceState(state: VoiceProfilesState, ready = true): void {
  snapshot = { state, activeProfile: activeOf(state), ready }
  for (const listener of listeners) listener()
}

export function getVoiceProfilesSnapshot(): VoiceProfilesSnapshot {
  return snapshot
}

export function subscribeVoiceProfiles(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function initializeVoiceProfiles(): Promise<void> {
  if (snapshot.ready) return Promise.resolve()
  if (loadPromise) return loadPromise
  loadPromise = window.chion
    .getVoiceProfiles()
    .then((loaded) => {
      const next = loaded.profiles.length > 0 ? loaded : seedDefault()
      replaceState(next)
      if (loaded.profiles.length === 0) void window.chion.saveVoiceProfiles(next)
    })
    .finally(() => {
      loadPromise = null
    })
  return loadPromise
}

function persist(state: VoiceProfilesState): void {
  replaceState(state)
  void window.chion.saveVoiceProfiles(state)
}

export function setActiveVoiceProfile(id: string): void {
  persist({ ...snapshot.state, activeId: id })
}

export function addVoiceProfile(): void {
  const profile: VoiceProfile = {
    id: uid(),
    name: '新声音',
    engine: 'sovits',
    baseURL: 'http://127.0.0.1:9880',
    refAudioPath: '',
    promptText: '',
    promptLang: 'ja',
    textLang: 'ja',
    speedFactor: 1.0
  }
  persist({ profiles: [...snapshot.state.profiles, profile], activeId: profile.id })
}

export function updateVoiceProfile(id: string, patch: Partial<VoiceProfile>): void {
  persist({
    ...snapshot.state,
    profiles: snapshot.state.profiles.map((profile) =>
      profile.id === id ? { ...profile, ...patch } : profile
    )
  })
}

export function deleteVoiceProfile(id: string): void {
  if (snapshot.state.profiles.length <= 1) return
  const profiles = snapshot.state.profiles.filter((profile) => profile.id !== id)
  const activeId = snapshot.state.activeId === id ? profiles[0].id : snapshot.state.activeId
  persist({ profiles, activeId })
}

export type UseVoiceProfiles = {
  state: VoiceProfilesState
  activeProfile: VoiceProfile | null
  ready: boolean
  setActive: (id: string) => void
  addProfile: () => void
  updateProfile: (id: string, patch: Partial<VoiceProfile>) => void
  deleteProfile: (id: string) => void
}

export function useVoiceProfiles(): UseVoiceProfiles {
  useEffect(() => {
    void initializeVoiceProfiles()
  }, [])
  const current = useSyncExternalStore(subscribeVoiceProfiles, getVoiceProfilesSnapshot)
  return {
    ...current,
    setActive: setActiveVoiceProfile,
    addProfile: addVoiceProfile,
    updateProfile: updateVoiceProfile,
    deleteProfile: deleteVoiceProfile
  }
}
