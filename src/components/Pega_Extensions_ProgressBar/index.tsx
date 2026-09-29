import { createUID, Text, withConfiguration } from '@pega/cosmos-react-core';
import { useCallback, useEffect, useState } from 'react';

import '../shared/create-nonce';

import {
  StyledProgressBar,
  StyledProgressFill,
  StyledProgressHeader,
  StyledProgressFraction,
  StyledProgressRail,
  StyledProgressStatus,
  StyledProgressTrack,
  StyledProgressValue,
} from './styles';
import {
  getPercentage,
  getProgressStatus,
  isProgressTone,
  normalizeProgress,
  type ProgressSize,
  type ProgressTone,
} from './utils';

export interface PegaExtensionsProgressBarProps {
  /** Widget label. */
  label: string;
  /** Shows a never-ending progress animation, skipping the data page and messaging service entirely. */
  indeterminateOnly?: boolean;
  /** Name of the data page providing the progress value. Refreshed only via the PCore messaging service. Ignored when `indeterminateOnly` is set. */
  dataPage?: string;
  /** Property in the data page response holding the current progress value. */
  valueProperty?: string;
  /** Property in the data page response holding the minimum progress value. */
  minProperty?: string;
  /** Property in the data page response holding the maximum progress value. */
  maxProperty?: string;
  /** Property in the data page response holding the progress tone. Overrides the static `tone` prop when valid. */
  toneProperty?: string;
  /** Supporting text shown below the label. */
  helperText?: string;
  /** Test identifier. */
  testId?: string;
  /** Visual tone for the progress fill. */
  tone?: ProgressTone;
  /** Track height. */
  size?: ProgressSize;
  /** Shows the percentage or in-progress label. */
  showValue?: boolean;
  /** Shows the completed fraction below the progress bar. */
  showFraction?: boolean;
  getPConnect: () => typeof PConnect;
}

export function PegaExtensionsProgressBar(props: PegaExtensionsProgressBarProps) {
  const {
    label,
    indeterminateOnly = false,
    dataPage,
    valueProperty = 'Value',
    minProperty = 'Min',
    maxProperty = 'Max',
    toneProperty = 'Tone',
    helperText,
    testId,
    tone = 'accent',
    size = 'regular',
    showValue = true,
    showFraction = true,
    getPConnect,
  } = props;

  const pConn = getPConnect();
  const localize = (text: string) => pConn.getLocalizedValue?.(text) || text;
  const [id] = useState(() => createUID());
  const [value, setValue] = useState<number | undefined>(undefined);
  const [min, setMin] = useState<number | undefined>(undefined);
  const [max, setMax] = useState<number | undefined>(undefined);
  const [dataPageTone, setDataPageTone] = useState<ProgressTone | undefined>(undefined);

  const loadFromDataPage = useCallback(() => {
    if (indeterminateOnly || !dataPage) return;
    PCore.getDataApiUtils()
      .getData(dataPage, {}, getPConnect().getContextName())
      .then((response: any) => {
        const data = response?.data?.data;
        const record = Array.isArray(data) ? data[0] : data;
        if (record) {
          if (record[valueProperty] !== undefined) setValue(Number(record[valueProperty]));
          if (record[minProperty] !== undefined) setMin(Number(record[minProperty]));
          if (record[maxProperty] !== undefined) setMax(Number(record[maxProperty]));
          if (isProgressTone(record[toneProperty])) setDataPageTone(record[toneProperty]);
        }
      })
      .catch(() => {});
  }, [indeterminateOnly, dataPage, valueProperty, minProperty, maxProperty, toneProperty, getPConnect]);

  /* The PCore messaging service is the only trigger for refreshing this widget's progress. */
  useEffect(() => {
    if (indeterminateOnly || !dataPage) return undefined;
    /* On a case, listen for that case's updates; on a page (no case context), listen for the data page itself */
    let caseID: string | undefined;
    try {
      caseID = getPConnect().getValue(PCore.getConstants().CASE_INFO.CASE_INFO_ID);
    } catch {
      caseID = undefined;
    }
    const filter: { matcher: string; criteria: Record<string, string> } = caseID
      ? { matcher: 'CASE', criteria: { caseId: caseID } }
      : { matcher: 'DATAPAGE_UPDATED', criteria: { datapage: dataPage } };
    const subscriptionId = PCore.getMessagingServiceManager().subscribe(
      filter,
      loadFromDataPage,
      getPConnect().getContextName(),
    );
    loadFromDataPage();
    return () => {
      PCore.getMessagingServiceManager().unsubscribe(subscriptionId);
    };
  }, [indeterminateOnly, dataPage, loadFromDataPage, getPConnect]);

  const indeterminate = indeterminateOnly || value === undefined;
  const effectiveTone = dataPageTone ?? tone;
  const normalizedMin = Number.isFinite(min) ? (min as number) : 0;
  const normalizedMax = Number.isFinite(max) && (max as number) > normalizedMin ? (max as number) : normalizedMin + 100;
  const normalizedValue = normalizeProgress(value ?? normalizedMin, normalizedMin, normalizedMax);
  const percentage = getPercentage(normalizedValue, normalizedMin, normalizedMax);
  const completedValue = normalizedValue - normalizedMin;
  const totalValue = normalizedMax - normalizedMin;
  const progressText = percentage === 100 ? localize('Complete') : `${percentage}%`;
  const fractionText = `${completedValue} ${localize('of')} ${totalValue} ${localize('completed')}`;
  const statusText = localize(getProgressStatus(percentage, effectiveTone));
  const ariaValueText = indeterminate ? localize('In progress') : `${percentage}% ${localize('complete')}`;
  const progressId = `${id}-progress`;
  const helperId = `${id}-helper`;

  return (
    <StyledProgressBar data-testid={testId}>
      <Text variant='h3'>{label}</Text>
      {helperText && (
        <Text id={helperId} variant='secondary'>
          {helperText}
        </Text>
      )}
      {showValue && !indeterminate && (
        <StyledProgressHeader>
          <StyledProgressStatus $tone={effectiveTone}>{statusText}</StyledProgressStatus>
          <StyledProgressValue>{progressText}</StyledProgressValue>
        </StyledProgressHeader>
      )}
      <StyledProgressRail>
        <StyledProgressTrack
          id={progressId}
          role='progressbar'
          aria-label={label}
          aria-describedby={helperText ? helperId : undefined}
          aria-valuemin={normalizedMin}
          aria-valuemax={normalizedMax}
          aria-valuenow={indeterminate ? undefined : normalizedValue}
          aria-valuetext={ariaValueText}
          $size={size}
        >
          <StyledProgressFill
            $complete={percentage === 100 && !indeterminate}
            $indeterminate={indeterminate}
            $percentage={percentage}
            $tone={effectiveTone}
          />
        </StyledProgressTrack>
        {showFraction && !indeterminate && <StyledProgressFraction>{fractionText}</StyledProgressFraction>}
      </StyledProgressRail>
    </StyledProgressBar>
  );
}

export default withConfiguration(PegaExtensionsProgressBar);
