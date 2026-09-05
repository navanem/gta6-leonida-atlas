import type { WalkRenderRegion } from './walk-region-streaming';

export type RockstarReferenceRegion = WalkRenderRegion;

export interface RockstarReferenceProfile {
  readonly primaryShot: string;
  readonly supportingShots: readonly string[];
  readonly requiredDetails: readonly string[];
  readonly officialSource: 'https://www.rockstargames.com/VI/media/screenshots';
}

/**
 * Art-direction contract for the six streamed arrival scenes. These identifiers
 * refer to Rockstar's official place screenshots; authored geometry remains an
 * approximate fan reconstruction rather than extracted game geometry.
 */
export const WALK_ROCKSTAR_REFERENCE_PROFILES: Readonly<
  Record<RockstarReferenceRegion, RockstarReferenceProfile>
> = {
  'leonida-keys': {
    primaryShot: 'Leonida_Keys_03',
    supportingShots: ['Leonida_Keys_01', 'Leonida_Keys_02', 'Leonida_Keys_05'],
    requiredDetails: ['Rusty Anchor porch', 'limestone garden', 'utility lines', 'marina fleet'],
    officialSource: 'https://www.rockstargames.com/VI/media/screenshots',
  },
  grassrivers: {
    primaryShot: 'Grassrivers_02',
    supportingShots: ['Grassrivers_01', 'Grassrivers_04', 'Grassrivers_05'],
    requiredDetails: [
      'stilt settlement',
      'sparse stilt outposts and docks',
      'dark tannin water',
      'airboats and wildlife',
    ],
    officialSource: 'https://www.rockstargames.com/VI/media/screenshots',
  },
  'port-gellhorn': {
    primaryShot: 'Port_Gellhorn_01',
    supportingShots: ['Port_Gellhorn_04', 'Port_Gellhorn_06'],
    requiredDetails: ['Starlet Motel', 'wet road', 'roadside neon', 'weathered low-rise sprawl'],
    officialSource: 'https://www.rockstargames.com/VI/media/screenshots',
  },
  ambrosia: {
    primaryShot: 'Ambrosia_01',
    supportingShots: ['Ambrosia_02', 'Ambrosia_04', 'Ambrosia_06'],
    requiredDetails: [
      'rural gas station',
      'utility grid',
      'commercial strip',
      'industrial horizon',
    ],
    officialSource: 'https://www.rockstargames.com/VI/media/screenshots',
  },
  'mount-kalaga': {
    primaryShot: 'Mount_Kalaga_National_Park_04',
    supportingShots: [
      'Mount_Kalaga_National_Park_01',
      'Mount_Kalaga_National_Park_02',
      'Mount_Kalaga_National_Park_05',
      'Mount_Kalaga_National_Park_06',
    ],
    requiredDetails: [
      'weathered red-earth rock cut',
      'pine forest',
      'rail bridge',
      'industrial silo and conveyor site (function approximate)',
    ],
    officialSource: 'https://www.rockstargames.com/VI/media/screenshots',
  },
  'vice-city': {
    primaryShot: 'Vice_City_09',
    supportingShots: ['Vice_City_03', 'Vice_City_06', 'Vice_City_08', 'Vice_City_10'],
    requiredDetails: ['mural viaduct', 'dense traffic', 'art-deco colour', 'waterfront skyline'],
    officialSource: 'https://www.rockstargames.com/VI/media/screenshots',
  },
};
