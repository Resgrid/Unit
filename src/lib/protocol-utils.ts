import { type CallProtocolsResultData } from '@/models/v4/callProtocols/callProtocolsResultData';

export const getProtocolKey = (protocol: CallProtocolsResultData): string => protocol.ProtocolId || JSON.stringify([protocol.DepartmentId, protocol.Code, protocol.Name, protocol.CreatedOn]);
