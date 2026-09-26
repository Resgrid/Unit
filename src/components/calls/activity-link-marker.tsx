import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, BadgeText } from '@/components/ui/badge';
import { getActivityLinkKind } from '@/lib/activity-link-kind';

interface ActivityLinkMarkerProps {
  /** The activity entry's `DestinationSource` (`StatusDestinationSources`). */
  source?: number | null;
}

/**
 * Compact marker next to a call activity status that the sender did not link to the call
 * themselves: "auto-linked" (info) or "inferred" (warning). Renders nothing for explicit links,
 * older rows and non-status entries.
 */
export const ActivityLinkMarker: React.FC<ActivityLinkMarkerProps> = ({ source }) => {
  const { t } = useTranslation();
  const kind = getActivityLinkKind(source);

  if (!kind) {
    return null;
  }

  return (
    <Badge
      action={kind === 'inferred' ? 'warning' : 'info'}
      size="sm"
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={t(`call_detail.activity_link.${kind}`)}
      accessibilityHint={t(`call_detail.activity_link.${kind}_hint`)}
      testID={`activity-link-marker-${kind}`}
    >
      <BadgeText>{t(`call_detail.activity_link.${kind}`)}</BadgeText>
    </Badge>
  );
};
