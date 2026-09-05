export const ANALYTICS_EVENTS = [
  'launch_checklist_view',
  'launch_checklist_item_completed',
  'launch_checklist_completed',
  'launch_checklist_reset',
  'launch_email_form_view',
  'launch_email_submit',
  'launch_email_success',
  'launch_email_error',
  'launch_hub_cta_click',
  'tool_navigation_click',
  'social_follow_click',
  'content_share_click',
  'street_leonida_view',
  'street_leonida_enter',
  'street_leonida_exit',
  'street_leonida_scene_jump',
  'street_leonida_media_action',
  'street_leonida_details_open',
  'street_leonida_copy_link',
  'street_leonida_search',
  'street_leonida_filter',
  'street_leonida_map_open',
  'street_leonida_source_click',
  'street_leonida_coverage_end',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsParameters = Record<string, string | number | boolean | null | undefined>;
export type GtagFunction = (
  command: 'event',
  eventName: AnalyticsEventName,
  parameters: Record<string, string | number | boolean>,
) => void;

const LEGACY_PARAMETER_NAMES = new Set([
  'item_id',
  'item_label',
  'progress',
  'total',
  'tool',
  'destination',
  'error_type',
  'platform',
  'content_type',
  'method',
  'place_slug',
  'viewpoint_slug',
  'link_type',
  'media_kind',
  'control',
  'result',
]);

type StreetAnalyticsEventName = Extract<AnalyticsEventName, `street_leonida_${string}`>;

const STREET_EVENT_PARAMETER_NAMES: Record<StreetAnalyticsEventName, ReadonlySet<string>> = {
  street_leonida_view: new Set(['place_slug', 'viewpoint_slug', 'media_kind']),
  street_leonida_enter: new Set(['place_slug', 'viewpoint_slug']),
  street_leonida_exit: new Set(['place_slug', 'viewpoint_slug']),
  street_leonida_scene_jump: new Set(['place_slug', 'viewpoint_slug', 'link_type']),
  street_leonida_media_action: new Set(['viewpoint_slug', 'media_kind', 'control']),
  street_leonida_details_open: new Set(['place_slug', 'viewpoint_slug']),
  street_leonida_copy_link: new Set(['place_slug', 'viewpoint_slug', 'result']),
  street_leonida_search: new Set(['result_count']),
  street_leonida_filter: new Set(['filter_type', 'result_count']),
  street_leonida_map_open: new Set(['map_mode']),
  street_leonida_source_click: new Set(['place_slug', 'viewpoint_slug', 'source_type']),
  street_leonida_coverage_end: new Set(['place_slug', 'viewpoint_slug']),
};

const STREET_CATEGORY_VALUES: Record<string, ReadonlySet<string>> = {
  link_type: new Set(['VIDEO_TIMELINE_NEXT', 'SAME_PLACE_JUMP', 'REGION_JUMP', 'MANUAL_JUMP']),
  media_kind: new Set(['STILL_IMAGE', 'VIDEO_EXCERPT', 'PANORAMA_360']),
  control: new Set([
    'play',
    'pause',
    'mute',
    'unmute',
    'previous-moment',
    'next-moment',
    'previous-scene',
    'next-scene',
    'pan-left',
    'pan-right',
    'pan-up',
    'pan-down',
  ]),
  result: new Set(['copied', 'failed']),
  filter_type: new Set(['region', 'category', 'media', 'position']),
  map_mode: new Set(['region-navigator', 'community-map']),
  source_type: new Set(['official', 'community', 'editorial']),
};

function isStreetEvent(eventName: AnalyticsEventName): eventName is StreetAnalyticsEventName {
  return eventName.startsWith('street_leonida_');
}

function safeStreetParameter(key: string, value: unknown): string | number | null {
  if (key === 'place_slug' || key === 'viewpoint_slug') {
    return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
      ? value.slice(0, 80)
      : null;
  }
  if (key === 'result_count') {
    return typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= 0 &&
      value <= 1_000_000
      ? value
      : null;
  }
  return typeof value === 'string' && STREET_CATEGORY_VALUES[key]?.has(value) ? value : null;
}

export function sanitizeAnalyticsParameters(
  eventName: AnalyticsEventName,
  parameters: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const safe: Record<string, string | number | boolean> = {};
  if (isStreetEvent(eventName)) {
    const allowed = STREET_EVENT_PARAMETER_NAMES[eventName];
    for (const [key, value] of Object.entries(parameters)) {
      if (!allowed.has(key)) continue;
      const sanitized = safeStreetParameter(key, value);
      if (sanitized !== null) safe[key] = sanitized;
    }
    return safe;
  }

  for (const [key, value] of Object.entries(parameters)) {
    if (!LEGACY_PARAMETER_NAMES.has(key)) continue;
    if (typeof value === 'string') safe[key] = value.slice(0, 100);
    if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
    if (typeof value === 'boolean') safe[key] = value;
  }
  return safe;
}

export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  parameters: Record<string, unknown> = {},
  gtag: GtagFunction | undefined = (globalThis as typeof globalThis & { gtag?: GtagFunction }).gtag,
): void {
  gtag?.('event', eventName, sanitizeAnalyticsParameters(eventName, parameters));
}
