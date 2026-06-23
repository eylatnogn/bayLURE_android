import Svg, { Circle, Path } from 'react-native-svg';

interface Props {
  size?: number;
  /** Stroke/fill color for the mark. */
  color?: string;
  /** Accent used for the sun/eye. */
  accent?: string;
}

/**
 * A simple, calm emblem: a leaping fish over two waves with a low sun — line
 * art, not flashy. Scales cleanly at any size.
 */
export function Logo({ size = 40, color = '#eaf3ea', accent = '#8fd0a6' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* low sun */}
      <Circle cx={34} cy={15} r={4} fill={accent} />
      {/* fish body */}
      <Path
        d="M9 22c5-6 14-7 19-3 2 1.6 3.4 3.6 4 5.4-0.6 1.8-2 3.8-4 5.4-5 4-14 3-19-3 2.2-2 3.4-3.9 3.4-4.8S11.2 24 9 22Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        fill="none"
      />
      {/* tail */}
      <Path
        d="M9 22c-1.6-1-3.2-1.4-4.6-1.2 1 2 1 5.4 0 7.4 1.4 0.2 3-0.2 4.6-1.2"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      {/* eye */}
      <Circle cx={26} cy={22.5} r={1.4} fill={color} />
      {/* waves */}
      <Path
        d="M6 38c3-2.6 6-2.6 9 0s6 2.6 9 0 6-2.6 9 0 6 2.6 9 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
        opacity={0.9}
      />
      <Path
        d="M6 43c3-2.6 6-2.6 9 0s6 2.6 9 0 6-2.6 9 0 6 2.6 9 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
        opacity={0.5}
      />
    </Svg>
  );
}
