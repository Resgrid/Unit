import { createPoiTypeMap, getPoiDisplayName, getPoiSelectionLabel, groupPoisByType, isPoiDestinationEnabled, sortPois } from '../poi-utils';

describe('poi-utils', () => {
  const poiTypes = [
    {
      PoiTypeId: 1,
      Name: 'Hospital',
      IsDestination: true,
    },
    {
      PoiTypeId: 2,
      Name: 'Shelter',
      IsDestination: false,
    },
  ] as any;

  const poiTypesById = createPoiTypeMap(poiTypes);

  it('uses the expected display-name fallback order', () => {
    expect(
      getPoiDisplayName(
        {
          PoiId: 1,
          PoiTypeId: 1,
          PoiTypeName: 'Hospital',
          Name: '',
          Address: '123 Main St',
          Note: 'Back entrance',
        } as any,
        poiTypesById
      )
    ).toBe('123 Main St');

    expect(
      getPoiDisplayName(
        {
          PoiId: 2,
          PoiTypeId: 2,
          PoiTypeName: '',
          Name: '',
          Address: '',
          Note: 'Temporary shelter',
        } as any,
        poiTypesById
      )
    ).toBe('Temporary shelter');
  });

  it('builds selection labels from name and address when both exist', () => {
    expect(
      getPoiSelectionLabel(
        {
          PoiId: 3,
          PoiTypeId: 1,
          PoiTypeName: 'Hospital',
          Name: 'Mercy Hospital',
          Address: '789 Care Way',
          Note: '',
        } as any,
        poiTypesById
      )
    ).toBe('Mercy Hospital - 789 Care Way');
  });

  it('resolves destination eligibility from the poi type when needed', () => {
    expect(
      isPoiDestinationEnabled(
        {
          PoiId: 4,
          PoiTypeId: 1,
          PoiTypeName: 'Hospital',
          IsDestination: false,
        } as any,
        poiTypesById
      )
    ).toBe(true);

    expect(
      isPoiDestinationEnabled(
        {
          PoiId: 5,
          PoiTypeId: 2,
          PoiTypeName: 'Shelter',
          IsDestination: false,
        } as any,
        poiTypesById
      )
    ).toBe(false);
  });

  it('groups and sorts POIs by type', () => {
    const grouped = groupPoisByType(
      [
        {
          PoiId: 10,
          PoiTypeId: 2,
          PoiTypeName: 'Shelter',
          Name: 'North Shelter',
          Address: '',
          Note: '',
        },
        {
          PoiId: 11,
          PoiTypeId: 1,
          PoiTypeName: 'Hospital',
          Name: 'Mercy Hospital',
          Address: '',
          Note: '',
        },
      ] as any,
      poiTypes as any
    );

    expect(grouped.map((group) => group.title)).toEqual(['Hospital', 'Shelter']);
    expect(grouped[0].items[0].PoiId).toBe(11);

    const sorted = sortPois(
      [
        {
          PoiId: 20,
          PoiTypeId: 1,
          PoiTypeName: 'Hospital',
          Name: 'Zulu Hospital',
          Address: '',
          Note: '',
        },
        {
          PoiId: 21,
          PoiTypeId: 1,
          PoiTypeName: 'Hospital',
          Name: 'Alpha Hospital',
          Address: '',
          Note: '',
        },
      ] as any,
      poiTypesById
    );

    expect(sorted.map((poi) => poi.PoiId)).toEqual([21, 20]);
  });
});
