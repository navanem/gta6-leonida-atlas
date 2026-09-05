import type { ReactNode } from 'react';
import type { LayerDefinition, Place, Position } from '../domain/types';

export interface AtlasAction {
  id: string;
  title: string;
  run: () => void | Promise<void>;
}
export interface AtlasTool {
  id: string;
  title: string;
  onPosition: (position: Position) => void;
}
export interface AtlasPanel {
  id: string;
  title: string;
  render: () => ReactNode;
}
export interface AtlasDataSource {
  id: string;
  load: () => Promise<Place[]>;
}
export interface AtlasFilter {
  id: string;
  matches: (place: Place) => boolean;
}
interface Events {
  selection: string | null;
  saved: undefined;
  error: string;
}

/** Trusted, bundled modules only. Registration returns a teardown function. */
export function createRegistry() {
  const layers = new Map<string, LayerDefinition>();
  const actions = new Map<string, AtlasAction>();
  const tools = new Map<string, AtlasTool>();
  const panels = new Map<string, AtlasPanel>();
  const sources = new Map<string, AtlasDataSource>();
  const filters = new Map<string, AtlasFilter>();
  const events = new Map<keyof Events, Set<(value: never) => void>>();
  function register<T extends { id: string }>(entries: Map<string, T>, entry: T) {
    if (entries.has(entry.id)) throw new Error(`Duplicate module registration: ${entry.id}`);
    entries.set(entry.id, entry);
    return () => {
      entries.delete(entry.id);
    };
  }
  return {
    layers,
    actions,
    tools,
    panels,
    sources,
    filters,
    registerLayer: (value: LayerDefinition) => register(layers, value),
    registerAction: (value: AtlasAction) => register(actions, value),
    registerTool: (value: AtlasTool) => register(tools, value),
    registerPanel: (value: AtlasPanel) => register(panels, value),
    registerDataSource: (value: AtlasDataSource) => register(sources, value),
    registerFilter: (value: AtlasFilter) => register(filters, value),
    on<K extends keyof Events>(name: K, listener: (value: Events[K]) => void) {
      const listeners = events.get(name) ?? new Set();
      events.set(name, listeners);
      listeners.add(listener as (value: never) => void);
      return () => {
        listeners.delete(listener as (value: never) => void);
      };
    },
    emit<K extends keyof Events>(name: K, value: Events[K]) {
      for (const listener of events.get(name) ?? []) {
        try {
          listener(value as never);
        } catch {
          /* A module cannot interrupt core persistence or selection. */
        }
      }
    },
  };
}
export const atlasRegistry = createRegistry();
