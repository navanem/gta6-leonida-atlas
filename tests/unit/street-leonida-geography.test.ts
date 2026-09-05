import { describe, expect, it } from 'vitest';

import { gtadbToWorld } from '../../src/features/street-leonida/leonida-coordinates';
import {
  EVIDENCE_LEVELS,
  GTADB_ANCHOR_PLACEMENT_EVIDENCE,
  OFFICIAL_SOURCE_URLS,
  OFFICIAL_VISIBLE_FEATURES,
  REGION_ARRIVAL_VIEWS,
  REGION_LOCAL_DATUM_POLICY,
  REVIEWED_GTADB_ANCHORS,
  STREET_LEONIDA_REGION_MANIFESTS,
} from '../../src/features/street-leonida/leonida-evidence';
import * as geography from '../../src/features/street-leonida/walk-geography';

const PUBLIC_REGIONS = [
  'vice-city',
  'leonida-keys',
  'grassrivers',
  'port-gellhorn',
  'ambrosia',
  'mount-kalaga-national-park',
] as const;

describe('Street Leonida evidence geography', () => {
  it('does not infer abandoned industrial ruins from Mount Kalaga imagery', () => {
    const visible = OFFICIAL_VISIBLE_FEATURES['mount-kalaga-national-park'].join(' ');
    expect(visible).toMatch(/industrial (structures|infrastructure)/i);
    expect(visible).not.toMatch(/ruins|abandoned/i);
  });

  it('does not present an unconfirmed Mount Kalaga industrial function as fact', () => {
    const profile = geography.getLeonidaZoneProfile(geography.REGION_WORLD.mountKalaga);

    expect(profile.detail).toContain('rock cuts');
    expect(profile.detail).toContain('winding roads');
    expect(profile.detail).not.toMatch(/quarry/i);
  });

  it('separates official regional identity from approximate community placement', () => {
    expect(Object.keys(STREET_LEONIDA_REGION_MANIFESTS)).toEqual(PUBLIC_REGIONS);

    for (const slug of PUBLIC_REGIONS) {
      const manifest = STREET_LEONIDA_REGION_MANIFESTS[slug];
      expect(manifest.officialSources.length).toBeGreaterThan(0);
      expect(
        manifest.officialSources.every(({ url }) =>
          Object.values(OFFICIAL_SOURCE_URLS).includes(url),
        ),
      ).toBe(true);
      expect(manifest.officialIdentityEvidence).toBe('CONFIRMED');
      expect(manifest.communityPlacementEvidence).toBe('APPROXIMATE');
      expect(EVIDENCE_LEVELS).toContain(manifest.officialIdentityEvidence);
      expect(EVIDENCE_LEVELS).toContain(manifest.communityPlacementEvidence);
      expect(manifest.features.documented.length).toBeGreaterThan(0);
      expect(manifest.features.approximate.length).toBeGreaterThan(0);
      expect(manifest.features.unknown.length).toBeGreaterThan(0);
      expect(manifest.reviewedAnchorIds.length).toBeGreaterThan(0);
      expect(
        manifest.reviewedAnchorIds.every((id) => REVIEWED_GTADB_ANCHORS[id] !== undefined),
      ).toBe(true);
    }

    expect(GTADB_ANCHOR_PLACEMENT_EVIDENCE).toBe('APPROXIMATE');
  });

  it('keeps low-region and approximate mountain elevation policy explicit', () => {
    expect(REGION_LOCAL_DATUM_POLICY['vice-city']).toMatchObject({
      kind: 'LOW',
      evidence: 'APPROXIMATE',
    });
    expect(REGION_LOCAL_DATUM_POLICY['leonida-keys']).toMatchObject({
      kind: 'LOW',
      evidence: 'APPROXIMATE',
    });
    expect(REGION_LOCAL_DATUM_POLICY.grassrivers).toMatchObject({
      kind: 'LOW',
      evidence: 'APPROXIMATE',
    });
    expect(REGION_LOCAL_DATUM_POLICY['port-gellhorn']).toMatchObject({
      kind: 'LOW',
      evidence: 'APPROXIMATE',
    });
    expect(REGION_LOCAL_DATUM_POLICY.ambrosia).toMatchObject({
      kind: 'LOW',
      evidence: 'APPROXIMATE',
    });
    expect(REGION_LOCAL_DATUM_POLICY['mount-kalaga-national-park']).toMatchObject({
      kind: 'APPROXIMATE_HEIGHT_FIELD',
      evidence: 'APPROXIMATE',
    });
  });

  it('retains literal source coordinates and deterministic transformed worlds for representative anchors', () => {
    expect(REVIEWED_GTADB_ANCHORS.L32.gtadb).toEqual({ x: 1973.5, y: 737 });
    expect(geography.VICE_CITY_POI_WORLD.hotelDixon).toEqual({ x: 3947, z: -1474 });
    expect(geography.AMBROSIA_WORLD.refinery).toEqual({
      x: -6033.021408764449,
      z: -6693.324710969762,
    });
    expect(geography.MOUNT_KALAGA_WORLD.centre).toEqual({
      x: -6843.9646072446185,
      z: -12736.292327275041,
    });
    expect(geography.GRASSRIVERS_WORLD.centre).toEqual({
      x: -6997.946910613249,
      z: 7105.246455306624,
    });
    expect(geography.PORT_GELLHORN_WORLD.hanksWaffles).toEqual({
      x: -12381.410195177297,
      z: -9041.429984986362,
    });
  });

  it('registers each audited Ambrosia source facet without promoting uncertain names or tags', () => {
    expect(REVIEWED_GTADB_ANCHORS.L594).toMatchObject({
      gtadb: { x: -2444.910983189574, y: 4198.580404492531 },
      confidence: 'UNKNOWN',
      evidence: {
        name: 'UNKNOWN',
        placement: 'APPROXIMATE',
        tagSignals: { levelTags: [], unconfirmed: false, demolished: false },
      },
    });
    expect(REVIEWED_GTADB_ANCHORS.L888).toMatchObject({
      gtadb: { x: -2050.1361147653543, y: 3163.5188173313654 },
      confidence: 'SUPPORTED',
      evidence: {
        name: 'KNOWN',
        placement: 'APPROXIMATE',
        tagSignals: { levelTags: [], unconfirmed: true, demolished: false },
      },
    });
    expect(REVIEWED_GTADB_ANCHORS.L1065).toMatchObject({
      gtadb: { x: -2060.372616795449, y: 3408.0846264475886 },
      confidence: 'SUPPORTED',
      evidence: {
        name: 'KNOWN',
        placement: 'APPROXIMATE',
        tagSignals: { levelTags: [], unconfirmed: true, demolished: false },
      },
    });
    expect(STREET_LEONIDA_REGION_MANIFESTS.ambrosia.reviewedAnchorIds).toEqual(
      expect.arrayContaining(['L399', 'L406', 'L594', 'L888', 'L1065']),
    );
  });

  it('uses zero-offset GTADB-derived world anchors for the four audited Ambrosia features', () => {
    expect(geography.AMBROSIA_WORLD.xeroStation).toEqual({
      x: -5413.5168337598325,
      z: -8471.653364176007,
    });
    expect(geography.AMBROSIA_WORLD.unknownUtilityL594).toEqual({
      x: -4889.821966379148,
      z: -8397.160808985062,
    });
    expect(geography.AMBROSIA_WORLD.radioTower).toEqual({
      x: -4100.2722295307085,
      z: -6327.037634662731,
    });
    expect(geography.AMBROSIA_WORLD.sugarFields).toEqual({
      x: -4120.745233590898,
      z: -6816.169252895177,
    });

    expect(geography.COMPATIBILITY_ANCHOR_DERIVATIONS['ambrosia.xeroStation']).toMatchObject({
      sourceAnchorId: 'L406',
      offsetMetres: { x: 0, z: 0 },
      evidence: 'SUPPORTED',
    });
    for (const id of [
      'ambrosia.unknownUtilityL594',
      'ambrosia.radioTower',
      'ambrosia.sugarFields',
    ]) {
      expect(geography.COMPATIBILITY_ANCHOR_DERIVATIONS[id]).toMatchObject({
        offsetMetres: { x: 0, z: 0 },
        evidence: 'APPROXIMATE',
      });
    }
  });

  it("publishes Hank's Waffles only as the supported named Port Gellhorn landmark", () => {
    expect(geography.VICE_CITY_POI_WORLD).not.toHaveProperty('hanksWaffles');
    expect(geography.COMPATIBILITY_ANCHOR_DERIVATIONS).not.toHaveProperty(
      'viceCityPois.hanksWaffles',
    );
    expect(geography.COMPATIBILITY_ANCHOR_DERIVATIONS['portGellhorn.hanksWaffles']).toMatchObject({
      sourceAnchorId: 'L310',
      offsetMetres: { x: 0, z: 0 },
      evidence: 'SUPPORTED',
      world: { x: -12381.410195177297, z: -9041.429984986362 },
    });
    expect(
      geography.ALL_LOCATION_ANCHORS.filter(({ label }) => label === "Hank's Waffles").map(
        ({ id }) => id,
      ),
    ).toEqual(['portGellhorn.hanksWaffles']);
  });

  it('distinguishes approximate zero-offset aliases from source-coordinate landmarks', () => {
    const approximateAliases = [
      'regions.mountKalaga',
      'regions.portGellhorn',
      'regions.ambrosia',
      'regions.grassrivers',
      'regions.viceCity',
      'regions.leonidaKeys',
      'regions.watsonBay',
      'viceCityDistricts.downtown',
      'viceCityDistricts.viceBeach',
      'ambrosia.town',
      'ambrosia.unknownUtilityL594',
      'ambrosia.radioTower',
      'ambrosia.sugarFields',
      'portGellhorn.centre',
      'grassrivers.centre',
      'leonidaKeys.northernEntrance',
      'leonidaKeys.watsonBay',
      'leonidaKeys.southernmostKeys',
      'mountKalaga.centre',
    ];
    for (const id of approximateAliases) {
      expect(geography.COMPATIBILITY_ANCHOR_DERIVATIONS[id]).toMatchObject({
        offsetMetres: { x: 0, z: 0 },
        evidence: 'APPROXIMATE',
      });
    }

    for (const id of [
      'viceCityPois.hotelDixon',
      'viceCityPois.megamundoTower',
      'ambrosia.refinery',
      'ambrosia.xeroStation',
      'portGellhorn.hanksWaffles',
    ]) {
      expect(geography.COMPATIBILITY_ANCHOR_DERIVATIONS[id]).toMatchObject({
        offsetMetres: { x: 0, z: 0 },
        evidence: 'SUPPORTED',
      });
    }

    expect(
      geography.ALL_LOCATION_ANCHORS.filter(({ evidence }) => evidence === 'SUPPORTED').map(
        ({ id, label }) => [id, label],
      ),
    ).toEqual([
      ['viceCityPois.megamundoTower', 'Megamundo'],
      ['viceCityPois.hotelDixon', 'Hotel Dixon'],
      ['viceCityPois.saharaArena', 'Sahara Arena'],
      ['ambrosia.refinery', 'Allied Crystal Sugar Mill'],
      ['ambrosia.xeroStation', 'Xero Gas Station'],
      ['portGellhorn.hanksWaffles', "Hank's Waffles"],
    ]);
  });

  it('marks every nonzero compatibility offset and arrival adjustment approximate', () => {
    const offsetDerivations = Object.values(geography.COMPATIBILITY_ANCHOR_DERIVATIONS).filter(
      ({ offsetMetres }) => offsetMetres.x !== 0 || offsetMetres.z !== 0,
    );
    expect(offsetDerivations.length).toBeGreaterThan(0);
    expect(offsetDerivations.every(({ evidence }) => evidence === 'APPROXIMATE')).toBe(true);
    expect(
      Object.values(REGION_ARRIVAL_VIEWS).every(
        ({ adjustment }) => adjustment.evidence === 'APPROXIMATE',
      ),
    ).toBe(true);
  });

  it('labels Ambrosia support-area infill as approximate rather than a named freight zone', () => {
    expect(geography.ALL_LOCATION_ANCHORS.find(({ id }) => id === 'ambrosia.freight')?.label).toBe(
      'Approximate industrial support area',
    );
  });

  it('uses reviewed locality evidence instead of arbitrary Key Lento and canyon aliases', () => {
    expect(geography.COMPATIBILITY_ANCHOR_DERIVATIONS['regions.keyLento']).toMatchObject({
      sourceAnchorId: 'L325',
      offsetMetres: { x: 0, z: 0 },
      evidence: 'APPROXIMATE',
    });
    expect(geography.COMPATIBILITY_ANCHOR_DERIVATIONS['leonidaKeys.keyLento']).toMatchObject({
      sourceAnchorId: 'L325',
      offsetMetres: { x: 0, z: 0 },
      evidence: 'APPROXIMATE',
    });
    expect(
      geography.ALL_LOCATION_ANCHORS.find(({ id }) => id === 'mountKalaga.riverRockCutStudy')
        ?.label,
    ).toBe('River / rock-cut study (APPROXIMATE)');
    expect(
      geography.ALL_LOCATION_ANCHORS.find(({ id }) => id === 'mountKalaga.riverCanyon'),
    ).toBeUndefined();
    expect(
      geography.getLeonidaZoneProfile(gtadbToWorld(REVIEWED_GTADB_ANCHORS.L325.gtadb)),
    ).toMatchObject({
      name: 'Leonida Keys',
    });
  });

  it('anchors Lake Leonida to L1000 and omits unsupported compatibility destinations', () => {
    const lakeWorld = gtadbToWorld(REVIEWED_GTADB_ANCHORS.L1000.gtadb);

    expect(geography.COMPATIBILITY_ANCHOR_DERIVATIONS['regions.lakeLeonida']).toMatchObject({
      sourceAnchorId: 'L1000',
      offsetMetres: { x: 0, z: 0 },
      evidence: 'APPROXIMATE',
    });
    expect(geography.COMPATIBILITY_ANCHOR_DERIVATIONS['ambrosia.lakeLeonida']).toMatchObject({
      sourceAnchorId: 'L1000',
      offsetMetres: { x: 0, z: 0 },
      evidence: 'APPROXIMATE',
    });
    expect(geography.PLACE_ANCHORS['lake-leonida']).toEqual(lakeWorld);
    expect(geography.PLACE_ANCHORS).not.toHaveProperty('waning-sands');
    expect(geography.PLACE_ANCHORS).not.toHaveProperty('capri');
  });

  it('places the Vice City arrival on the mapped boulevard east of the landmark', () => {
    const arrival = REGION_ARRIVAL_VIEWS['vice-city'];
    const distance = Math.hypot(
      arrival.adjustment.offsetMetres.x,
      arrival.adjustment.offsetMetres.z,
    );

    expect(arrival.adjustment.offsetMetres.x).toBeGreaterThanOrEqual(85);
    expect(arrival.adjustment.offsetMetres.x).toBeLessThanOrEqual(115);
    expect(arrival.adjustment.offsetMetres.z).toBeGreaterThanOrEqual(40);
    expect(arrival.adjustment.offsetMetres.z).toBeLessThanOrEqual(70);
    expect(distance).toBeGreaterThanOrEqual(100);
    expect(distance).toBeLessThanOrEqual(125);

    const renderedView = geography.PLACE_ENTRY_VIEWS['vice-city']!;
    expect(renderedView.target.x).toBeCloseTo(renderedView.position.x, 6);
    expect(renderedView.position.z - renderedView.target.z).toBeGreaterThanOrEqual(95);
    expect(renderedView.position.z - renderedView.target.z).toBeLessThanOrEqual(115);
  });

  it('does not expose the superseded 0–100/manual-grid model', () => {
    expect(geography).not.toHaveProperty('LEONIDA_GRID');
    expect(geography).not.toHaveProperty('LEONIDA_GRID_ORIGIN');
    expect(geography).not.toHaveProperty('LEONIDA_WORLD_SCALE');
    expect(geography).not.toHaveProperty('gridToWorld');
  });
});
