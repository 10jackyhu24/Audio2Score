// components/ProgressBar.tsx
// 通用進度條組件 - 支援確定進度和不確定進度（loading spinner）
import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  indeterminate?: boolean; // 如果為 true，顯示不確定進度（動畫條）
  height?: number;
  color?: string;
  backgroundColor?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  showPercentage = true,
  indeterminate = false,
  height = 8,
  color = COLORS.primary,
  backgroundColor = '#E0E0E0',
}) => {
  // 確保進度在 0-100 範圍內
  const clampedProgress = Math.max(0, Math.min(100, progress));

  // 不確定進度動畫
  const [animatedValue] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (indeterminate) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [indeterminate]);

  const animatedWidth = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{label}</Text>
          {showPercentage && !indeterminate && (
            <Text style={styles.percentage}>{clampedProgress.toFixed(0)}%</Text>
          )}
        </View>
      )}
      <View style={[styles.track, { height, backgroundColor }]}>
        {indeterminate ? (
          <Animated.View
            style={[
              styles.indeterminateBar,
              {
                height,
                backgroundColor: color,
                width: '30%',
                left: animatedWidth,
              },
            ]}
          />
        ) : (
          <View
            style={[
              styles.fill,
              {
                width: `${clampedProgress}%`,
                height,
                backgroundColor: color,
              },
            ]}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: '#666',
  },
  percentage: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  track: {
    width: '100%',
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    borderRadius: BORDER_RADIUS.sm,
  },
  indeterminateBar: {
    position: 'absolute',
    borderRadius: BORDER_RADIUS.sm,
  },
});
