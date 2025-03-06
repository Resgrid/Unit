import { router } from 'expo-router';
import { RefreshCcwDotIcon, SearchIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { CallCard } from '@/components/calls/call-card';
import ZeroState from '@/components/common/zero-state';
import { Box } from '@/components/ui/box';
import { FlatList } from '@/components/ui/flat-list';
import { Input, InputField, InputSlot } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { Text } from '@/components/ui/text';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { useCallsStore } from '@/stores/calls/store';

export default function Calls() {
  const { calls, isLoading, error, fetchCalls, fetchCallPriorities } =
    useCallsStore();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const { colorScheme } = useColorScheme();

  useEffect(() => {
    fetchCallPriorities();
    fetchCalls();
  }, [fetchCalls, fetchCallPriorities]);

  const handleRefresh = () => {
    fetchCalls();
    fetchCallPriorities();
  };

  // Filter calls based on search query
  const filteredCalls = calls.filter(
    (call) =>
      call.CallId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (call.Nature?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  if (error) {
    return (
      <View className="size-full flex-1">
        <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5 lg:min-w-[700px]">
          <Text className="error text-center">{error}</Text>
        </Box>
      </View>
    );
  }

  return (
    <View className="size-full flex-1">
      <Box
        className={`size-full w-full flex-1 ${colorScheme === 'dark' ? 'bg-neutral-950' : 'bg-neutral-50'}`}
      >
        {/* Add search input */}
        <Box className="px-4 py-2">
          <Input
            className={`${colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-neutral-50'}`}
          >
            <InputSlot>
              <SearchIcon size={20} className="text-gray-500" />
            </InputSlot>
            <InputField
              placeholder={t('common.search')}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </Input>
        </Box>

        <Box className="flex-1 px-4">
          <FlatList<CallResultData>
            data={filteredCalls}
            renderItem={({ item }: { item: CallResultData }) => (
              <Pressable onPress={() => router.push(`/call/${item.CallId}`)}>
                <CallCard
                  call={item}
                  priority={useCallsStore
                    .getState()
                    .callPriorities.find(
                      (p: { Id: number }) => p.Id === item.Priority
                    )}
                />
              </Pressable>
            )}
            keyExtractor={(item: CallResultData) => item.CallId}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={handleRefresh}
              />
            }
            ListEmptyComponent={
              isLoading ? (
                <Loading />
              ) : (
                <ZeroState
                  heading={t('calls.no_calls')}
                  description={t('calls.no_calls_description')}
                  icon={RefreshCcwDotIcon}
                />
              )
            }
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </Box>
      </Box>
    </View>
  );
}
