import { type CallVideoFeedResult } from '@/models/v4/callVideoFeeds/callVideoFeedResult';
import { type SaveCallVideoFeedResult } from '@/models/v4/callVideoFeeds/saveCallVideoFeedResult';

import { createApiEndpoint } from '../common/client';

const getCallVideoFeedsApi = createApiEndpoint('/CallVideoFeeds/GetCallVideoFeeds');
const saveCallVideoFeedApi = createApiEndpoint('/CallVideoFeeds/SaveCallVideoFeed');
const editCallVideoFeedApi = createApiEndpoint('/CallVideoFeeds/EditCallVideoFeed');
const deleteCallVideoFeedApi = createApiEndpoint('/CallVideoFeeds/DeleteCallVideoFeed');

export interface SaveCallVideoFeedInput {
  CallId: number;
  Name: string;
  Url: string;
  FeedType?: number;
  FeedFormat?: number;
  Description?: string;
  Latitude?: string;
  Longitude?: string;
  SortOrder?: number;
}

export interface EditCallVideoFeedInput extends SaveCallVideoFeedInput {
  CallVideoFeedId: string;
}

export const getCallVideoFeeds = async (callId: number) => {
  const response = await getCallVideoFeedsApi.get<CallVideoFeedResult>({
    callId: encodeURIComponent(callId),
  });
  return response.data;
};

export const saveCallVideoFeed = async (input: SaveCallVideoFeedInput) => {
  const response = await saveCallVideoFeedApi.post<SaveCallVideoFeedResult>({
    CallId: input.CallId,
    Name: input.Name,
    Url: input.Url,
    FeedType: input.FeedType,
    FeedFormat: input.FeedFormat,
    Description: input.Description,
    Latitude: input.Latitude,
    Longitude: input.Longitude,
    SortOrder: input.SortOrder,
  });
  return response.data;
};

export const editCallVideoFeed = async (input: EditCallVideoFeedInput) => {
  const response = await editCallVideoFeedApi.put<SaveCallVideoFeedResult>({
    CallVideoFeedId: input.CallVideoFeedId,
    CallId: input.CallId,
    Name: input.Name,
    Url: input.Url,
    FeedType: input.FeedType,
    FeedFormat: input.FeedFormat,
    Description: input.Description,
    Latitude: input.Latitude,
    Longitude: input.Longitude,
    SortOrder: input.SortOrder,
  });
  return response.data;
};

export const deleteCallVideoFeed = async (feedId: string) => {
  const response = await deleteCallVideoFeedApi.delete<SaveCallVideoFeedResult>({
    feedId: encodeURIComponent(feedId),
  });
  return response.data;
};
