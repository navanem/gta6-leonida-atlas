import { create } from 'zustand';

/** A stable controller can put its entry button in a route-owned sidebar slot. */
export const useExtensionHost = create<{ entryTarget: HTMLDivElement | null }>(() => ({
  entryTarget: null,
}));
export function setAccountEntryTarget(entryTarget: HTMLDivElement | null): void {
  useExtensionHost.setState({ entryTarget });
}
