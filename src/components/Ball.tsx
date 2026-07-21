import { ballColor } from '../lib/engine';

type Props = {
  n: number;
  size?: 'sm' | 'md' | 'lg';
  special?: boolean;
  delay?: number;
  animate?: boolean;
};

const sizes = {
  sm: 'w-9 h-9 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-xl',
};

export default function Ball({ n, size = 'md', special = false, delay = 0, animate = true }: Props) {
  return (
    <div
      className={`relative ${sizes[size]} rounded-full ${ballColor(n)} flex items-center justify-center font-bold text-white shadow-lg ${
        special ? 'ring-4 ring-white/70 ring-offset-2 ring-offset-transparent' : ''
      } ${animate ? 'animate-pop' : ''}`}
      style={animate ? { animationDelay: `${delay}ms` } : undefined}
    >
      <span className="drop-shadow-sm">{n}</span>
      {special && (
        <span className="absolute -bottom-5 text-[10px] font-semibold text-amber-300 whitespace-nowrap">
          特別號
        </span>
      )}
    </div>
  );
}
