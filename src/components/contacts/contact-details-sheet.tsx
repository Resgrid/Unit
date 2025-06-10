import { BuildingIcon, Edit2Icon, HomeIcon, MailIcon, MapPinIcon, PhoneIcon, SmartphoneIcon, StarIcon, TrashIcon, UserIcon, XIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { BottomSheet, BottomSheetBackdrop, BottomSheetContent, BottomSheetDragIndicator, BottomSheetPortal } from '@/components/ui/bottomsheet';
import { Button, ButtonText } from '@/components/ui/button';
import { ContactType } from '@/models/v4/contacts/contactResultData';
import { useContactsStore } from '@/stores/contacts/store';

export const ContactDetailsSheet: React.FC = () => {
  const { t } = useTranslation();
  const { contacts, selectedContactId, isDetailsOpen, closeDetails } = useContactsStore();

  const selectedContact = React.useMemo(() => {
    if (!selectedContactId) return null;
    return contacts.find((contact) => contact.ContactId === selectedContactId);
  }, [contacts, selectedContactId]);

  const handleDelete = async () => {
    if (selectedContactId) {
      //await removeContact(selectedContactId);
      closeDetails();
    }
  };

  if (!selectedContact) return null;

  return (
    <BottomSheet onClose={closeDetails} onOpen={() => {}}>
      <BottomSheetPortal snapPoints={['60%']} handleComponent={BottomSheetDragIndicator} backdropComponent={BottomSheetBackdrop}>
        <BottomSheetContent>
          <View className="flex-1 px-4 pb-4">
            <View className="flex-row items-center justify-between pt-4">
              <Text className="text-xl font-semibold text-gray-900 dark:text-white">{t('contacts.details')}</Text>
              <TouchableOpacity onPress={closeDetails}>
                <XIcon size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 pt-4" showsVerticalScrollIndicator={false}>
              <View className="items-center pb-6">
                <Avatar size="xl" className="mb-2">
                  {selectedContact.ImageUrl ? (
                    <AvatarImage source={{ uri: selectedContact.ImageUrl }} alt={selectedContact.Name} />
                  ) : (
                    <View className="size-full items-center justify-center bg-primary-500">
                      {selectedContact.Type === ContactType.Person ? <UserIcon size={48} color="#fff" /> : <BuildingIcon size={48} color="#fff" />}
                    </View>
                  )}
                </Avatar>

                <View className="flex-row items-center">
                  <Text className="text-2xl font-bold text-gray-900 dark:text-white">{selectedContact.Name}</Text>
                  {selectedContact.IsImportant ? <StarIcon size={20} className="ml-2" color="#FFD700" /> : null}
                </View>

                <Text className="text-sm text-gray-500 dark:text-gray-400">{selectedContact.Type === ContactType.Person ? t('contacts.person') : t('contacts.company')}</Text>
              </View>

              <View className="space-y-4">
                {selectedContact.Email ? (
                  <View className="flex-row items-center">
                    <View className="mr-3 size-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
                      <MailIcon size={20} color="#6366F1" />
                    </View>
                    <View>
                      <Text className="text-sm text-gray-500 dark:text-gray-400">{t('contacts.email')}</Text>
                      <Text className="text-base text-gray-900 dark:text-white">{selectedContact.Email}</Text>
                    </View>
                  </View>
                ) : null}

                {selectedContact.Phone ? (
                  <View className="flex-row items-center">
                    <View className="mr-3 size-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
                      <PhoneIcon size={20} color="#6366F1" />
                    </View>
                    <View>
                      <Text className="text-sm text-gray-500 dark:text-gray-400">{t('contacts.phone')}</Text>
                      <Text className="text-base text-gray-900 dark:text-white">{selectedContact.Phone}</Text>
                    </View>
                  </View>
                ) : null}

                {selectedContact.Mobile ? (
                  <View className="flex-row items-center">
                    <View className="mr-3 size-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
                      <SmartphoneIcon size={20} color="#6366F1" />
                    </View>
                    <View>
                      <Text className="text-sm text-gray-500 dark:text-gray-400">{t('contacts.mobile')}</Text>
                      <Text className="text-base text-gray-900 dark:text-white">{selectedContact.Mobile}</Text>
                    </View>
                  </View>
                ) : null}

                {selectedContact.Address ? (
                  <View className="flex-row items-center">
                    <View className="mr-3 size-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
                      <HomeIcon size={20} color="#6366F1" />
                    </View>
                    <View>
                      <Text className="text-sm text-gray-500 dark:text-gray-400">{t('contacts.address')}</Text>
                      <Text className="text-base text-gray-900 dark:text-white">{selectedContact.Address}</Text>
                    </View>
                  </View>
                ) : null}

                {selectedContact.City && selectedContact.State ? (
                  <View className="flex-row items-center">
                    <View className="mr-3 size-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
                      <MapPinIcon size={20} color="#6366F1" />
                    </View>
                    <View>
                      <Text className="text-sm text-gray-500 dark:text-gray-400">{t('contacts.cityState')}</Text>
                      <Text className="text-base text-gray-900 dark:text-white">
                        {selectedContact.City}, {selectedContact.State} {selectedContact.Zip ? selectedContact.Zip : ''}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {selectedContact.Notes ? (
                  <View className="mt-4">
                    <Text className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">{t('contacts.notes')}</Text>
                    <Text className="text-base text-gray-900 dark:text-white">{selectedContact.Notes}</Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            <View className="flex-row space-x-4 pt-4">
              <Button variant="outline" className="flex-1 border-gray-300 dark:border-gray-700">
                <Edit2Icon size={18} color="#6366F1" className="mr-2" />
                <ButtonText>{t('contacts.edit')}</ButtonText>
              </Button>
              <Button variant="outline" className="flex-1 border-red-300 dark:border-red-700" onPress={handleDelete}>
                <TrashIcon size={18} color="#EF4444" className="mr-2" />
                <ButtonText>{t('contacts.delete')}</ButtonText>
              </Button>
            </View>
          </View>
        </BottomSheetContent>
      </BottomSheetPortal>
    </BottomSheet>
  );
};
