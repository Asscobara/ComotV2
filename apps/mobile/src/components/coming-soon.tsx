import React from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from './ui';

export function ComingSoon({ icon }: { icon: string }) {
  const { t } = useTranslation();
  return (
    <Screen scroll={false} style={{ justifyContent: 'center' }}>
      <EmptyState icon={icon} title={t('common.comingSoon')} body={t('common.comingSoonBody')} />
    </Screen>
  );
}
