import { router } from 'expo-router';
import { PlusIcon, RefreshCcwDotIcon, SearchIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { CallCard } from '@/components/calls/call-card';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { Box } from '@/components/ui/box';
import { Fab, FabIcon } from '@/components/ui/fab';
import { FlatList } from '@/components/ui/flat-list';
import { Input, InputField, InputSlot } from '@/components/ui/input';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { useCallsStore } from '@/stores/calls/store';

export default function Calls() {
  const { calls, isLoading, error, fetchCalls, fetchCallPriorities } = useCallsStore();
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

  const handleNewCall = () => {
    router.push('/call/new/');
  };

  // Filter calls based on search query
  const filteredCalls = calls.filter((call) => call.CallId.toLowerCase().includes(searchQuery.toLowerCase()) || (call.Nature?.toLowerCase() || '').includes(searchQuery.toLowerCase()));

  // Render content based on loading, error, and data states
  const renderContent = () => {
    if (isLoading) {
      return <Loading text={t('calls.loading')} />;
    }

    if (error) {
      return <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />;
    }

    return (
      <FlatList<CallResultData>
        data={filteredCalls}
        renderItem={({ item }: { item: CallResultData }) => (
          <Pressable onPress={() => router.push(`/call/${item.CallId}`)}>
            <CallCard call={item} priority={useCallsStore.getState().callPriorities.find((p: { Id: number }) => p.Id === item.Priority)} />
          </Pressable>
        )}
        keyExtractor={(item: CallResultData) => item.CallId}
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} />}
        ListEmptyComponent={<ZeroState heading={t('calls.no_calls')} description={t('calls.no_calls_description')} icon={RefreshCcwDotIcon} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    );
  };

  return (
    <View className="size-full flex-1">
      <Box className={`size-full w-full flex-1 ${colorScheme === 'dark' ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
        {/* Search input */}
        <Box className="px-4 py-2">
          <Input className={`${colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-neutral-50'}`}>
            <InputSlot>
              <SearchIcon size={20} className="text-gray-500" />
            </InputSlot>
            <InputField placeholder={t('common.search')} value={searchQuery} onChangeText={setSearchQuery} />
          </Input>
        </Box>

        {/* Main content */}
        <Box className="flex-1 px-4">{renderContent()}</Box>

        {/* FAB button for creating new call */}
        <Fab placement="bottom right" size="lg" onPress={handleNewCall} testID="new-call-fab">
          <FabIcon as={PlusIcon} size="lg" />
        </Fab>
      </Box>
    </View>
  );
}
