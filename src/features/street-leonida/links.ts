import type { PublicStreetLink, StreetLinkType } from './types';

export function getStreetLinkLabel(type: StreetLinkType): 'Next moment' | 'Jump to scene' {
  return type === 'VIDEO_TIMELINE_NEXT' ? 'Next moment' : 'Jump to scene';
}

export function derivePreviousMoment(
  currentSlug: string,
  links: readonly PublicStreetLink[],
): string | null {
  return (
    links.find((link) => link.type === 'VIDEO_TIMELINE_NEXT' && link.toSlug === currentSlug)
      ?.fromSlug ?? null
  );
}

export interface StreetNavigation {
  previousMoment: PublicStreetLink | null;
  nextMoment: PublicStreetLink | null;
  previousScene: PublicStreetLink | null;
  nextScene: PublicStreetLink | null;
}

export function resolveStreetNavigation(
  currentSlug: string,
  links: readonly PublicStreetLink[],
): StreetNavigation {
  const timeline = (link: PublicStreetLink) => link.type === 'VIDEO_TIMELINE_NEXT';
  return {
    previousMoment: links.find((link) => timeline(link) && link.toSlug === currentSlug) ?? null,
    nextMoment: links.find((link) => timeline(link) && link.fromSlug === currentSlug) ?? null,
    previousScene: links.find((link) => !timeline(link) && link.toSlug === currentSlug) ?? null,
    nextScene: links.find((link) => !timeline(link) && link.fromSlug === currentSlug) ?? null,
  };
}

export function getCoverageState(
  currentSlug: string,
  links: readonly PublicStreetLink[],
  coverageMessage: string | null,
): { terminal: boolean; message: string | null } {
  const terminal = !links.some((link) => link.fromSlug === currentSlug);
  return {
    terminal,
    message: terminal ? coverageMessage?.trim() || 'Coverage ends here' : null,
  };
}
