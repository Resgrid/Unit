import * as React from 'react';

import { FocusAwareStatusBar, SafeAreaView, ScrollView } from '@/components/ui';
import ZeroState from '@/components/common/zero-state';
import { UserIcon, View } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function Contacts() {
  const { t } = useTranslation();
  return (
    <>
      <View className="flex-1 bg-gray-50 dark:bg-gray-900">
        <ZeroState
          heading={t('contacts.title')}
          description={t('contacts.description')}
          icon={UserIcon}
        />
      </View>
    </>
  );
}
