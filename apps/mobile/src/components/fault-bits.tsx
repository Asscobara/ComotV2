import type { FaultCategory, FaultStatus } from '@comot/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Tag } from './ui';

export const CATEGORY_GLYPHS: Record<FaultCategory, string> = {
  plumbing: '🚰',
  electricity: '⚡',
  gardening: '🌿',
  elevator: '🛗',
  cleaning: '🧹',
  roofing: '🏠',
  general: '🛠️',
};

const STATUS_TONES: Record<FaultStatus, 'warning' | 'primary' | 'success' | 'neutral'> = {
  reported: 'warning',
  in_progress: 'primary',
  resolved: 'success',
  closed: 'neutral',
};

export function FaultStatusTag({ status }: { status: FaultStatus }) {
  const { t } = useTranslation();
  return <Tag label={t(`faults.status_${status}`)} tone={STATUS_TONES[status]} />;
}
