import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { RouteStopStatus } from '@/models/v4/routes/routeInstanceStopResultData';

interface StopMarkerProps {
  stopOrder: number;
  status: number;
}

const statusColors = {
  [RouteStopStatus.Pending]: '#9ca3af',
  [RouteStopStatus.InProgress]: '#3b82f6',
  [RouteStopStatus.Completed]: '#22c55e',
  [RouteStopStatus.Skipped]: '#eab308',
};

export const StopMarker: React.FC<StopMarkerProps> = ({ stopOrder, status }) => {
  const color = statusColors[status as RouteStopStatus] || statusColors[RouteStopStatus.Pending];

  return (
    <View style={[styles.container, { backgroundColor: color }]}>
      <Text style={styles.text}>{stopOrder}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  text: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
