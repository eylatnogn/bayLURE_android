import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
} from 'react-native-svg';
import type { ArtKey } from '@/engine/lureDatabase';

interface Props {
  art: string;
  /** Rendered width in px; height follows the 64×40 aspect. */
  size?: number;
  /** Silhouette color. */
  color?: string;
}

/**
 * In-app silhouettes for each lure/rig/bait — bold, single-color filled shapes
 * traced from real tackle proportions, kept icon-simple so they read at a
 * glance. Look-alike baits share a drawing via their {@link ArtKey}.
 */
export function LureArt({ art, size = 58, color = '#3b4c40' }: Props) {
  const h = size * (40 / 64);
  return (
    <Svg width={size} height={h} viewBox="0 0 64 40" fill="none">
      <G strokeLinejoin="round" strokeLinecap="round">{render(art as ArtKey, color)}</G>
    </Svg>
  );
}

// Thin treble-hook silhouette hanging from (x, y).
function Treble({ x, y, c }: { x: number; y: number; c: string }) {
  return (
    <G stroke={c} strokeWidth={1.2} fill="none">
      <Line x1={x} y1={y} x2={x} y2={y + 4} />
      <Path d={`M${x - 3} ${y + 4.5} h6`} />
      <Path d={`M${x - 3} ${y + 4.5} q-0.4 4 2 5`} />
      <Path d={`M${x} ${y + 4.5} v5`} />
      <Path d={`M${x + 3} ${y + 4.5} q0.4 4 -2 5`} />
    </G>
  );
}

// Thin single J-hook hanging from (x, y).
function JHook({ x, y, c }: { x: number; y: number; c: string }) {
  return (
    <Path
      d={`M${x} ${y} v5 q0 4 3.6 4 q3 0 2.8 -3`}
      stroke={c}
      strokeWidth={1.2}
      fill="none"
    />
  );
}

// Surface ripple under a topwater / float.
function Water({ c }: { c: string }) {
  return (
    <Path
      d="M6 32 q4 -3 8 0 t8 0 t8 0 t8 0 t8 0"
      stroke={c}
      strokeWidth={1.2}
      fill="none"
      opacity={0.45}
    />
  );
}

function render(art: ArtKey, c: string) {
  switch (art) {
    // ---- Hard baits ----
    case 'crankbait':
      return (
        <>
          <Path d="M18 13C30 9 46 11 51 19 46 27 30 29 20 25 13 22 13 16 18 13Z" fill={c} />
          <Path d="M19 22 11 28 15 30 23 25Z" fill={c} />
          <Line x1={11} y1={28} x2={6} y2={27} stroke={c} strokeWidth={1.4} />
          <Treble x={30} y={27} c={c} />
          <Treble x={46} y={24} c={c} />
        </>
      );
    case 'lipless':
      return (
        <>
          <Path d="M14 20C16 11 30 8 40 11 50 14 50 26 40 29 30 32 16 29 14 20Z" fill={c} />
          <Line x1={31} y1={9} x2={29} y2={4} stroke={c} strokeWidth={1.4} />
          <Treble x={28} y={29} c={c} />
          <Treble x={42} y={27} c={c} />
        </>
      );
    case 'jerkbait':
      return (
        <>
          <Path d="M14 18Q28 13 50 17L55 19 50 21Q28 25 14 20Z" fill={c} />
          <Path d="M14 20 9 23 12 24.5 16 21.5Z" fill={c} />
          <Line x1={9} y1={23} x2={5} y2={22} stroke={c} strokeWidth={1.4} />
          <Treble x={26} y={23} c={c} />
          <Treble x={40} y={23} c={c} />
        </>
      );
    case 'topwater-walker':
      return (
        <>
          <Path d="M14 18Q16 13 26 13 44 13 52 18 44 23 26 23 16 23 14 18Z" fill={c} />
          <Line x1={14} y1={18} x2={9} y2={17} stroke={c} strokeWidth={1.4} />
          <Treble x={28} y={23} c={c} />
          <Treble x={44} y={23} c={c} />
          <Water c={c} />
        </>
      );
    case 'popper':
      return (
        <>
          <Path d="M18 12C32 11 47 14 52 19 47 24 32 27 19 25 14 19 18 12 18 12Z" fill={c} />
          <Line x1={18} y1={12} x2={15} y2={8} stroke={c} strokeWidth={1.4} />
          <Treble x={31} y={25} c={c} />
          <Treble x={46} y={23} c={c} />
          <Water c={c} />
        </>
      );
    case 'spoon':
      return (
        <>
          <Path d="M8 20C8 13 18 11 30 13 44 15 53 18 57 20 53 22 44 25 30 27 18 29 8 27 8 20Z" fill={c} />
          <Line x1={8} y1={20} x2={4} y2={20} stroke={c} strokeWidth={1.4} />
          <Treble x={55} y={20} c={c} />
        </>
      );
    case 'bladebait':
      return (
        <>
          <Path d="M18 9 40 12 47 22 27 31 16 20Z" fill={c} />
          <Line x1={30} y1={10} x2={30} y2={5} stroke={c} strokeWidth={1.4} />
          <Treble x={23} y={30} c={c} />
          <Treble x={45} y={22} c={c} />
        </>
      );
    case 'frog':
      return (
        <>
          <Path d="M16 20C16 14 24 13 31 14 42 15 46 18 46 21 46 25 40 27 30 27 20 27 16 25 16 20Z" fill={c} />
          <Circle cx={22} cy={13} r={2.4} fill={c} />
          <Circle cx={28} cy={12.5} r={2.4} fill={c} />
          <Path d="M43 16Q51 13 53 16 55 19 51 20" stroke={c} strokeWidth={2.4} fill="none" />
          <Path d="M43 24Q51 27 53 24 55 21 51 20" stroke={c} strokeWidth={2.4} fill="none" />
        </>
      );

    // ---- Wire & bladed baits ----
    case 'spinnerbait':
      return (
        <>
          <Path d="M24 9 44 12M24 9 20 24" stroke={c} strokeWidth={1.7} fill="none" />
          <Path d="M44 12Q51 9 50 15 47 18 44 14Z" fill={c} />
          <Circle cx={19} cy={25} r={3} fill={c} />
          <Path d="M19 26Q33 27 35 31 26 34 19 31Z" fill={c} />
        </>
      );
    case 'buzzbait':
      return (
        <>
          <Path d="M24 9 42 11M24 9 20 24" stroke={c} strokeWidth={1.7} fill="none" />
          <Polygon points="44,11 37,7 41,12.5" fill={c} />
          <Polygon points="44,11 50,7 47,12.5" fill={c} />
          <Circle cx={44} cy={11} r={1.5} fill={c} />
          <Circle cx={19} cy={25} r={3} fill={c} />
          <Path d="M19 26Q33 27 35 31 26 34 19 31Z" fill={c} />
        </>
      );
    case 'inline-spinner':
      return (
        <>
          <Line x1={8} y1={20} x2={42} y2={20} stroke={c} strokeWidth={1.5} />
          <Line x1={8} y1={20} x2={4} y2={20} stroke={c} strokeWidth={1.4} />
          <Ellipse cx={16} cy={15.5} rx={4.5} ry={7} fill={c} />
          <Polygon points="26,17 38,20 26,23" fill={c} />
          <Path d="M40 20Q50 16 56 20 50 24 40 20Z" fill={c} />
        </>
      );
    case 'chatterbait':
      return (
        <>
          <Polygon points="8,21 12,16 17,17 18,22 14,27 9,25" fill={c} />
          <Circle cx={21} cy={22} r={3.2} fill={c} />
          <Line x1={19} y1={20} x2={16} y2={15} stroke={c} strokeWidth={1.4} />
          <Path d="M24 22C32 19 42 20 47 22 42 24 32 25 24 22Z" fill={c} />
          <Polygon points="46,18 53,16 53,24 46,23" fill={c} />
        </>
      );

    // ---- Jigs ----
    case 'jig':
      return (
        <>
          <Circle cx={16} cy={16} r={5} fill={c} />
          <Line x1={13} y1={12} x2={10} y2={8} stroke={c} strokeWidth={1.4} />
          <Path d="M18 17Q34 17 41 26 33 32 19 30 14 23 18 17Z" fill={c} />
        </>
      );
    case 'football-jig':
      return (
        <>
          <Ellipse cx={16} cy={18} rx={7} ry={4.5} fill={c} />
          <Line x1={14} y1={14} x2={11} y2={9} stroke={c} strokeWidth={1.4} />
          <Path d="M20 18Q35 19 41 27 33 32 20 30 16 24 20 18Z" fill={c} />
        </>
      );
    case 'bucktail':
      return (
        <>
          <Circle cx={15} cy={17} r={5} fill={c} />
          <Line x1={13} y1={13} x2={10} y2={8} stroke={c} strokeWidth={1.4} />
          <Path d="M19 14Q40 15 52 18 40 21 19 22Z" fill={c} />
        </>
      );

    // ---- Soft plastics ----
    case 'paddletail':
      return (
        <>
          <Circle cx={13} cy={18} r={4} fill={c} />
          <Line x1={11} y1={15} x2={8} y2={10} stroke={c} strokeWidth={1.4} />
          <Path d="M15 18C26 14 40 15 47 18 40 21 26 22 15 18Z" fill={c} />
          <Path d="M46 14Q53 13 53 18 53 23 46 22Z" fill={c} />
        </>
      );
    case 'worm-texas':
      return (
        <>
          <Polygon points="6,16 17,18 17,22 6,24" fill={c} />
          <Path d="M17 20C24 16 28 25 35 21 42 17 48 24 55 19" stroke={c} strokeWidth={4.5} fill="none" />
        </>
      );
    case 'wacky':
      return (
        <>
          <Path d="M9 15C12 24 22 24 32 22 42 24 52 24 55 15" stroke={c} strokeWidth={5} fill="none" />
          <JHook x={31} y={18} c={c} />
        </>
      );
    case 'ned':
      return (
        <>
          <Ellipse cx={15} cy={18} rx={4.2} ry={3.4} fill={c} />
          <Line x1={13} y1={15} x2={10} y2={11} stroke={c} strokeWidth={1.4} />
          <Path d="M18 19C26 17 34 20 41 19" stroke={c} strokeWidth={4.5} fill="none" />
        </>
      );
    case 'shakyhead':
      return (
        <>
          <Circle cx={17} cy={28} r={3.6} fill={c} />
          <Line x1={15} y1={25} x2={12} y2={22} stroke={c} strokeWidth={1.4} />
          <Path d="M19 27C21 18 27 12 33 9" stroke={c} strokeWidth={4} fill="none" />
        </>
      );
    case 'grub':
      return (
        <>
          <Circle cx={14} cy={18} r={3.6} fill={c} />
          <Line x1={12} y1={15} x2={9} y2={10} stroke={c} strokeWidth={1.4} />
          <Path d="M17 18C24 17 30 18 35 19" stroke={c} strokeWidth={4} fill="none" />
          <Path d="M34 16C42 15 45 24 39 28 44 23 41 19 33 21Z" fill={c} />
        </>
      );
    case 'tube':
      return (
        <>
          <Path d="M13 16 34 15Q39 15 39 19.5 39 24 34 24L13 23Z" fill={c} />
          <Line x1={14} y1={16} x2={11} y2={11} stroke={c} strokeWidth={1.4} />
          <G stroke={c} strokeWidth={1.6} fill="none">
            <Line x1={39} y1={16} x2={48} y2={15} />
            <Line x1={39} y1={18} x2={49} y2={18} />
            <Line x1={39} y1={20} x2={48} y2={21} />
            <Line x1={39} y1={22} x2={47} y2={24} />
          </G>
        </>
      );

    // ---- Rigs ----
    case 'dropshot':
      return (
        <>
          <Line x1={28} y1={5} x2={28} y2={33} stroke={c} strokeWidth={1.3} />
          <Path d="M28 16q5 0 5 3 0 3 -3 3" stroke={c} strokeWidth={1.3} fill="none" />
          <Ellipse cx={38} cy={18} rx={4} ry={1.8} fill={c} />
          <Path d="M25 33 31 33 30 40 26 40Z" fill={c} />
        </>
      );
    case 'carolina':
      return (
        <>
          <Line x1={6} y1={21} x2={20} y2={21} stroke={c} strokeWidth={1.3} />
          <Ellipse cx={15} cy={21} rx={6} ry={4} fill={c} />
          <Circle cx={23} cy={21} r={1.6} fill={c} />
          <Circle cx={27} cy={21} r={1.6} fill="none" stroke={c} strokeWidth={1} />
          <Line x1={29} y1={21} x2={41} y2={21} stroke={c} strokeWidth={1.1} />
          <Path d="M40 21C46 18 52 24 57 20" stroke={c} strokeWidth={3.5} fill="none" />
        </>
      );
    case 'bottom-rig':
      return (
        <>
          <Line x1={14} y1={8} x2={14} y2={22} stroke={c} strokeWidth={1.3} />
          <Polygon points="9,22 19,22 14,32" fill={c} />
          <Line x1={19} y1={24} x2={40} y2={22} stroke={c} strokeWidth={1.1} />
          <Path d="M42 22C46 19 52 19 55 22 52 25 46 25 42 22Z" fill={c} />
          <JHook x={49} y={24} c={c} />
        </>
      );
    case 'popping-cork':
      return (
        <>
          <Path d="M16 8 26 8 23 18 19 18Z" fill={c} />
          <Line x1={21} y1={5} x2={21} y2={20} stroke={c} strokeWidth={1.2} />
          <Line x1={21} y1={18} x2={30} y2={29} stroke={c} strokeWidth={1.1} />
          <Ellipse cx={34} cy={30} rx={4} ry={2.4} fill={c} />
          <JHook x={33} y={30} c={c} />
          <Water c={c} />
        </>
      );
    case 'slip-bobber':
      return (
        <>
          <Circle cx={20} cy={14} r={6} fill={c} />
          <Line x1={20} y1={8} x2={20} y2={4} stroke={c} strokeWidth={1.2} />
          <Line x1={20} y1={20} x2={20} y2={30} stroke={c} strokeWidth={1.1} />
          <Path d="M16 31C19 28 26 28 29 31 26 34 19 34 16 31Z" fill={c} />
          <Polygon points="16,31 12,29 13,33" fill={c} />
          <Water c={c} />
        </>
      );

    // ---- Natural bait ----
    case 'shrimp':
      return (
        <>
          <Path d="M19 16C30 10 45 13 46 21 46 28 38 31 29 28 37 26 38 19 30 18 25 17 22 17 19 16Z" fill={c} />
          <Polygon points="29,28 24,31 27,24" fill={c} />
          <Path d="M45 19Q53 16 58 18M45 21Q53 20 58 23" stroke={c} strokeWidth={1} fill="none" />
          <G stroke={c} strokeWidth={0.9} fill="none">
            <Line x1={30} y1={27} x2={29} y2={31} />
            <Line x1={35} y1={26} x2={35} y2={30} />
            <Line x1={40} y1={24} x2={41} y2={28} />
          </G>
        </>
      );
    case 'baitfish':
      return (
        <>
          <Path d="M16 20C22 14 42 14 48 18L54 13 52 20 54 27 48 22C42 26 22 26 16 20Z" fill={c} />
          <Circle cx={42} cy={18} r={1.4} fill="#fbfdf8" />
        </>
      );
    case 'worm-night':
      return (
        <Path
          d="M7 22C11 14 16 28 21 21 26 14 31 28 36 21 41 14 50 24 57 19"
          stroke={c}
          strokeWidth={3.4}
          fill="none"
        />
      );
    case 'crayfish':
      return (
        <>
          <Ellipse cx={33} cy={21} rx={11} ry={6} fill={c} />
          <Polygon points="44,21 51,17 50,25" fill={c} />
          <Path d="M22 18C16 15 11 17 10 20 13 19 16 20 19 21Z" fill={c} />
          <Path d="M22 24C16 27 11 25 10 22 13 23 16 22 19 21Z" fill={c} />
          <Path d="M23 18Q14 14 8 16M23 24Q14 28 8 26" stroke={c} strokeWidth={0.9} fill="none" />
          <G stroke={c} strokeWidth={0.9} fill="none">
            <Line x1={30} y1={26} x2={28} y2={31} />
            <Line x1={35} y1={27} x2={35} y2={32} />
            <Line x1={40} y1={25} x2={42} y2={30} />
          </G>
        </>
      );
    case 'crab':
      return (
        <>
          <Ellipse cx={32} cy={23} rx={11} ry={7} fill={c} />
          <Path d="M22 17C17 12 12 13 11 17 14 16 17 17 20 19Z" fill={c} />
          <Path d="M42 17C47 12 52 13 53 17 50 16 47 17 44 19Z" fill={c} />
          <G stroke={c} strokeWidth={1.1} fill="none">
            <Line x1={24} y1={27} x2={19} y2={32} />
            <Line x1={29} y1={29} x2={26} y2={34} />
            <Line x1={35} y1={29} x2={38} y2={34} />
            <Line x1={40} y1={27} x2={45} y2={32} />
          </G>
          <Circle cx={28} cy={17} r={1.3} fill={c} />
          <Circle cx={36} cy={17} r={1.3} fill={c} />
        </>
      );
    case 'cricket':
      return (
        <>
          <Ellipse cx={33} cy={23} rx={11} ry={5} fill={c} />
          <Circle cx={45} cy={22} r={3.4} fill={c} />
          <Path d="M48 20Q55 15 58 16M48 23Q56 21 59 23" stroke={c} strokeWidth={0.9} fill="none" />
          <Path d="M27 24Q22 31 16 30 21 28 22 23Z" fill={c} />
          <Line x1={18} y1={30} x2={12} y2={33} stroke={c} strokeWidth={1.2} />
        </>
      );
    case 'dough':
      return (
        <>
          <Circle cx={25} cy={21} r={6} fill={c} />
          <Circle cx={31} cy={18} r={4.6} fill={c} />
          <Circle cx={31} cy={24} r={4} fill={c} />
          <JHook x={26} y={9} c={c} />
        </>
      );
    case 'sandflea':
      return (
        <>
          <Ellipse cx={30} cy={21} rx={12} ry={9} fill={c} />
          <G stroke={c} strokeWidth={1} fill="none">
            <Path d="M18 17Q12 15 10 17" />
            <Path d="M18 25Q12 27 10 25" />
            <Line x1={18} y1={21} x2={11} y2={21} />
          </G>
        </>
      );
    default:
      return (
        <Path d="M28 8v6q0 8 7 8 6 0 6-6" stroke={c} strokeWidth={2} fill="none" />
      );
  }
}
