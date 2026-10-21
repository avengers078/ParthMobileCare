import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import { AnimatedCard } from './common/AnimatedCard';

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  highlightBorder?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  noPadding?: boolean;
  disabled?: boolean;
}

/**
 * Universal Card component
 * Backed by AnimatedCard with native driver spring response, elevation preservation,
 * and high-end tactile feedback.
 */
export const Card: React.FC<CardProps> = props => {
  return <AnimatedCard {...props} />;
};

// AppCard alias for modern nomenclature
export const AppCard = Card;
