import React from 'react';
import { Badge, BadgeProps, BadgeVariant } from './Badge';

export type StatusBadgeVariant = BadgeVariant;
export type StatusBadgeProps = BadgeProps;

/**
 * StatusBadge
 * Unified with Badge component for single source of truth,
 * while preserving all existing exports, props, and variant semantics.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = props => {
  return <Badge {...props} />;
};
