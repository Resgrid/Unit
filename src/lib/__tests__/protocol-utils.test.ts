import { getProtocolKey } from '@/lib/protocol-utils';
import { CallProtocolsResultData } from '@/models/v4/callProtocols/callProtocolsResultData';

const createProtocol = (overrides: Partial<CallProtocolsResultData>): CallProtocolsResultData => Object.assign(new CallProtocolsResultData(), overrides);

describe('getProtocolKey', () => {
  it('uses ProtocolId when it is available', () => {
    expect(getProtocolKey(createProtocol({ ProtocolId: 'protocol-42' }))).toBe('protocol-42');
  });

  it('creates stable, distinct keys for protocols without IDs', () => {
    const firstProtocol = createProtocol({
      DepartmentId: 'department-1',
      Name: 'First Protocol',
      Code: 'FIRST',
      CreatedOn: '2026-01-01T00:00:00Z',
    });
    const secondProtocol = createProtocol({
      DepartmentId: 'department-1',
      Name: 'Second Protocol',
      Code: 'SECOND',
      CreatedOn: '2026-01-01T00:00:00Z',
    });
    const firstKey = getProtocolKey(firstProtocol);
    const secondKey = getProtocolKey(secondProtocol);

    expect(firstKey).toBe(getProtocolKey(firstProtocol));
    expect(firstKey).not.toBe(secondKey);
    expect([secondProtocol, firstProtocol].map(getProtocolKey)).toEqual([secondKey, firstKey]);
  });
});
