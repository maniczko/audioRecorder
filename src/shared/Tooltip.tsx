import * as React from 'react';
import { Tooltip as BaseTooltip } from '@base-ui/react';
import './Tooltip.css';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  delay?: number;
  placement?:
    | 'top'
    | 'right'
    | 'bottom'
    | 'left'
    | 'top-start'
    | 'top-end'
    | 'right-start'
    | 'right-end'
    | 'bottom-start'
    | 'bottom-end'
    | 'left-start'
    | 'left-end';
}

export function Tooltip({ content, children, delay = 300, placement = 'top' }: TooltipProps) {
  if (!content) {
    return children;
  }

  return (
    <BaseTooltip.Provider delay={delay}>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger asChild>{children}</BaseTooltip.Trigger>
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner
            side={placement.split('-')[0] as any}
            align={placement.split('-')[1] as any || 'center'}
            sideOffset={4}
          >
            <BaseTooltip.Popup className="CustomTooltipPopup">
              {content}
              <BaseTooltip.Arrow className="CustomTooltipArrow" />
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  );
}
