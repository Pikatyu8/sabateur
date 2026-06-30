// src/components/TunnelCardView.tsx
import React from 'react';
import { TunnelCard } from '../types';
import { Pickaxe, Coins, HelpCircle, Layers, ShieldAlert, Eye } from 'lucide-react';

interface TunnelCardViewProps {
  card: TunnelCard;
  rotated?: boolean;
  flipped?: boolean;
  isGoal?: boolean;
  isGold?: boolean;
  isEntrance?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  preview?: boolean;
}

export const TunnelCardView: React.FC<TunnelCardViewProps> = ({
  card,
  rotated = false,
  flipped = false,
  isGoal = false,
  isGold = false,
  isEntrance = false,
  isSelected = false,
  onClick,
  preview = false,
}) => {
  const baseClass = `relative w-16 h-24 rounded-lg flex flex-col justify-between p-1 select-none overflow-hidden transition-all duration-200 cursor-pointer text-xs
    ${preview ? 'opacity-60 border-2 border-dashed border-emerald-400 bg-stone-800/80' : ''}
    ${isSelected ? 'scale-105 ring-2 ring-amber-400 shadow-lg shadow-amber-400/30' : 'hover:scale-[1.02] shadow-md'}
  `;

  if (isGoal && !flipped && card.id === 'goal_hidden') {
    return (
      <div className={`${baseClass} bg-gradient-to-br from-stone-800 to-amber-950 border border-amber-800/60 flex items-center justify-center`} onClick={onClick}>
        <div className="absolute inset-1 rounded border border-amber-900/25 flex flex-col items-center justify-center gap-1">
          <HelpCircle className="w-5 h-5 text-amber-700/80 animate-pulse" />
          <span className="font-mono text-[9px] text-amber-700/70 uppercase tracking-widest font-bold">Цель</span>
        </div>
      </div>
    );
  }

  if (isGoal && (flipped || card.id !== 'goal_hidden') && isGold) {
    return (
      <div className={`${baseClass} bg-gradient-to-br from-stone-900 via-stone-800 to-stone-950 border border-yellow-500/50 shadow-xl`} onClick={onClick}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-yellow-950/95 border-2 border-yellow-400 flex flex-col items-center justify-center">
          <Coins className="w-5 h-5 text-yellow-400" />
        </div>
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-yellow-400 font-mono">ЗОЛОТО</div>
      </div>
    );
  }

  if (isGoal && (flipped || card.id !== 'goal_hidden') && !isGold) {
    return (
      <div className={`${baseClass} bg-gradient-to-br from-stone-900 via-stone-800 to-stone-950 border border-stone-600/50`} onClick={onClick}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-stone-950/95 border-2 border-stone-500 flex flex-col items-center justify-center">
          <Layers className="w-5 h-5 text-stone-400" />
        </div>
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-stone-400 font-mono">КАМЕНЬ</div>
      </div>
    );
  }

  if (isEntrance) {
    return (
      <div className={`${baseClass} bg-gradient-to-br from-amber-900 to-stone-900 border-2 border-amber-800 text-amber-100`} onClick={onClick}>
        <div className="absolute top-0 left-[calc(50%-5px)] w-[10px] h-full bg-amber-700/40" />
        <div className="absolute left-0 top-[calc(50%-5px)] h-[10px] w-full bg-amber-700/40" />
        <div className="absolute inset-0 flex flex-col justify-between py-2 items-center">
          <div className="text-[9px] font-mono uppercase font-bold text-amber-500">Вход</div>
          <Pickaxe className="w-4 h-4 text-amber-500" />
        </div>
      </div>
    );
  }

  const isDeadEnd = card.connectedParts.every(part => part.length === 1);
  const rotationClass = rotated ? 'rotate-180' : '';

  return (
    <div className={`${baseClass} bg-stone-900 border border-stone-800/80 text-stone-300 ${rotationClass}`} onClick={onClick}>
      {/* Отрисовка кристалла для геологов */}
      {card.hasCrystal && (
        <div className="absolute top-1 left-1 z-20 bg-stone-950/80 px-1 rounded border border-cyan-500/30">
          <span className="text-[8px] font-bold text-cyan-400">💎</span>
        </div>
      )}

      {card.exits.top && <div className="absolute top-0 left-[calc(50%-6px)] w-3 h-1/2 bg-amber-800/70" />}
      {card.exits.bottom && <div className="absolute bottom-0 left-[calc(50%-6px)] w-3 h-1/2 bg-amber-800/70" />}
      {card.exits.left && <div className="absolute left-0 top-[calc(50%-6px)] h-3 w-1/2 bg-amber-800/70" />}
      {card.exits.right && <div className="absolute right-0 top-[calc(50%-6px)] h-3 w-1/2 bg-amber-800/70" />}

      {isDeadEnd ? (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-stone-700 rounded flex items-center justify-center">
          <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
        </div>
      ) : (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-amber-800/70" />
      )}
    </div>
  );
};