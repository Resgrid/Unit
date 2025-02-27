import React, { useEffect, useState } from 'react';
import { RefreshControl, Pressable, View } from 'react-native';
import { Box } from '@/components/ui/box';
import { FlatList } from '@/components/ui/flat-list';
import { Text } from '@/components/ui/text';
import { useCallsStore } from '@/stores/calls/store';
import { CallCard } from '@/components/calls/call-card';
import { FocusAwareStatusBar, SafeAreaView } from '@/components/ui';
import { CallResultData } from '@/models/v4/calls/callResultData';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Loading } from '@/components/ui/loading';
import ZeroState from '@/components/common/zero-state';
import { Icon, RefreshCcwDotIcon, SearchIcon } from 'lucide-react-native';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';

export default function Calls() {
  const { calls, isLoading, error, fetchCalls, fetchCallPriorities } =
    useCallsStore();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

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
        <Box className="p-5 rounded-lg m-3 mt-5 bg-background-50 gap-5 min-h-[200px] max-w-[600px] lg:min-w-[700px] w-full self-center">
          <Text className="error text-center">{error}</Text>
        </Box>
      </View>
    );
  }

  return (
    <View className="size-full flex-1">
      <Box className="size-full flex-1 w-full bg-gray-50">
        {/* Add search input */}
        <Box className="px-4 py-2">
          <Input className="bg-white">
            <InputSlot>
              <InputIcon>
                <SearchIcon size={20} className="text-gray-500" />
              </InputIcon>
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
