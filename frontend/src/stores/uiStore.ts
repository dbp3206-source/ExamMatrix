import { create } from 'zustand'

interface UiState {
  dashboardMethodologyOpen: boolean
  toggleDashboardMethodology: () => void
  setDashboardMethodologyOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  dashboardMethodologyOpen: false,
  toggleDashboardMethodology: () =>
    set((state) => ({ dashboardMethodologyOpen: !state.dashboardMethodologyOpen })),
  setDashboardMethodologyOpen: (open) => set({ dashboardMethodologyOpen: open }),
}))
