import { type ContactResultData } from '@/models/v4/contacts/contactResultData';
import { type SaveContactInput } from '@/models/v4/contacts/saveContactInput';

import { createCachedApiEndpoint } from '../common/cached-client';
import { createApiEndpoint } from '../common/client';

// Define API endpoints
const getAllContactsApi = createCachedApiEndpoint('/Contacts/GetAllContacts', {
  ttl: 60 * 1000 * 1440, // Cache for 1 day
  enabled: true,
});

const getContactApi = createApiEndpoint('/Contacts/GetContact');
const saveContactApi = createApiEndpoint('/Contacts/SaveContact');
const deleteContactApi = createApiEndpoint('/Contacts/DeleteContact');

// Export functions to interact with the API
export const getAllContacts = async () => {
  const response = await getAllContactsApi.get<{ Data: ContactResultData[] }>();
  return response.data;
};

export const getContact = async (contactId: string) => {
  const response = await getContactApi.get<{ Data: ContactResultData }>({
    contactId,
  });
  return response.data;
};

export const saveContact = async (data: SaveContactInput) => {
  const response = await saveContactApi.post<{ Data: string }>({
    ...data,
  });
  return response.data;
};

export const deleteContact = async (contactId: string) => {
  const response = await deleteContactApi.delete<{ Data: boolean }>({
    contactId,
  });
  return response.data;
};
