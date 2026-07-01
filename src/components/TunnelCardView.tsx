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
  // Оптимизация: Заменен transition-all на точечные переходы трансформации и теней
  const baseClass = `relative w-16 h-24 rounded-lg flex flex-col justify-between p-1 select-none overflow-hidden transition-[transform,shadow] duration-200 cursor-pointer text-xs
    ${preview ? 'opacity-60 border-2 border-dashed border-emerald-400 bg-stone-800/80' : ''}
    ${isSelected ? 'scale-105 ring-2 ring-amber-400 shadow-lg shadow-amber-400/30' : 'hover:scale-[1.02] shadow-md'}
  `;

  // 1. Закрытая карта цели (Оптимизация: Удален тяжелый backdrop-blur, заменен на bg-stone-950/90)
  if (isGoal && !flipped && card.id === 'goal_hidden') {
    return (
      <div
        id={`card-goal-hidden-${card.id}`}
        className={`${baseClass} bg-gradient-to-br from-stone-800 to-amber-950 border border-amber-800/60 flex items-center justify-center`}
        onClick={onClick}
      >
        <div className="absolute top-0 left-[calc(50%-5px)] w-2.5 h-1/2 bg-amber-900/10 border-x border-amber-950/20" />
        <div className="absolute bottom-0 left-[calc(50%-5px)] w-2.5 h-1/2 bg-amber-900/10 border-x border-amber-950/20" />
        <div className="absolute left-0 top-[calc(50%-5px)] h-2.5 w-1/2 bg-amber-900/10 border-y border-amber-950/20" />
        <div className="absolute right-0 top-[calc(50%-5px)] h-2.5 w-1/2 bg-amber-900/10 border-y border-amber-950/20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-amber-950/20 border border-amber-900/20" />

        <div className="absolute inset-1 rounded border border-amber-900/25 flex flex-col items-center justify-center gap-1 bg-stone-950/90 z-10">
          <HelpCircle className="w-5 h-5 text-amber-700/80 animate-pulse" />
          <span className="font-mono text-[9px] text-amber-700/70 uppercase tracking-widest font-bold">Цель</span>
        </div>
      </div>
    );
  }

  // 2. Раскрытая золотая жила
  if (isGoal && (flipped || card.id !== 'goal_hidden') && isGold) {
    return (
      <div
        id={`card-goal-gold-${card.id}`}
        className={`${baseClass} bg-gradient-to-br from-stone-900 via-stone-800 to-stone-950 border border-yellow-500/50 text-stone-300 shadow-xl shadow-yellow-500/10`}
        onClick={onClick}
      >
        <div className="absolute top-0 left-[calc(50%-6px)] w-3 h-1/2 bg-amber-500/35 border-x border-amber-600/30" />
        <div className="absolute bottom-0 left-[calc(50%-6px)] w-3 h-1/2 bg-amber-500/35 border-x border-amber-600/30" />
        <div className="absolute left-0 top-[calc(50%-6px)] h-3 w-1/2 bg-amber-500/35 border-y border-amber-600/30" />
        <div className="absolute right-0 top-[calc(50%-6px)] h-3 w-1/2 bg-amber-500/35 border-y border-amber-600/30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-amber-500/40 border border-amber-600/40" />

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-yellow-950/95 border-2 border-yellow-400 flex flex-col items-center justify-center shadow-lg shadow-yellow-500/20 z-10">
          <Coins className="w-5 h-5 text-yellow-400 animate-bounce" />
        </div>

        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-yellow-400 font-mono tracking-wider bg-stone-950/80 px-1 rounded z-10 border border-yellow-500/20">
          {flipped ? 'ЗОЛОТО!' : 'ТАЙНОЕ'}
        </div>
        
        {!flipped && (
          <div className="absolute top-1 right-1 p-0.5 bg-stone-950/80 rounded border border-amber-500/30 z-10 animate-pulse">
            <Eye className="w-3 h-3 text-amber-400" />
          </div>
        )}
      </div>
    );
  }

  // 3. Раскрытый обычный камень
  if (isGoal && (flipped || card.id !== 'goal_hidden') && !isGold) {
    return (
      <div
        id={`card-goal-stone-${card.id}`}
        className={`${baseClass} bg-gradient-to-br from-stone-900 via-stone-800 to-stone-950 border border-stone-600/50 text-stone-400`}
        onClick={onClick}
      >
        <div className="absolute top-0 left-[calc(50%-6px)] w-3 h-1/2 bg-stone-700/30 border-x border-stone-800/30" />
        <div className="absolute bottom-0 left-[calc(50%-6px)] w-3 h-1/2 bg-stone-700/30 border-x border-stone-800/30" />
        <div className="absolute left-0 top-[calc(50%-6px)] h-3 w-1/2 bg-stone-700/30 border-y border-stone-800/30" />
        <div className="absolute right-0 top-[calc(50%-6px)] h-3 w-1/2 bg-stone-700/30 border-y border-stone-800/30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-stone-700/40 border border-stone-800/40" />

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-stone-950/95 border-2 border-stone-500 flex flex-col items-center justify-center shadow-md z-10">
          <Layers className="w-5 h-5 text-stone-400" />
        </div>

        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-stone-400 font-mono tracking-wider bg-stone-950/80 px-1 rounded z-10 border border-stone-600/20">
          {flipped ? 'КАМЕНЬ' : 'ТАЙНЫЙ'}
        </div>

        {!flipped && (
          <div className="absolute top-1 right-1 p-0.5 bg-stone-950/80 rounded border border-stone-500/30 z-10 animate-pulse">
            <Eye className="w-3 h-3 text-stone-400" />
          </div>
        )}
      </div>
    );
  }

  // 4. Вход
  if (isEntrance) {
    return (
      <div
        id="card-entrance"
        className={`${baseClass} bg-gradient-to-br from-amber-900 to-stone-900 border-2 border-amber-800 text-amber-100`}
        onClick={onClick}
      >
        <div className="absolute top-0 left-[calc(50%-5px)] w-[10px] h-full bg-amber-700/40" />
        <div className="absolute left-0 top-[calc(50%-5px)] h-[10px] w-full bg-amber-700/40" />
        <div className="absolute inset-0 flex flex-col justify-between py-2 items-center z-10">
          <div className="text-[9px] font-mono uppercase font-bold text-amber-500/80">Вход</div>
          <Pickaxe className="w-3 h-3 text-amber-500" />
        </div>
      </div>
    );
  }

  // 5. Обычная карта туннеля
  const isDeadEnd = card.connectedParts.every(part => part.length === 1);
  const rotationClass = rotated ? 'rotate-180' : '';

  return (
    <div
      id={`card-${card.id}`}
      className={`${baseClass} bg-stone-900 border border-stone-800/80 text-stone-300 ${rotationClass}`}
      onClick={onClick}
    >
      {card.hasCrystal && (
        <div className="absolute top-1 left-1 z-20 bg-stone-950/80 px-1 rounded border border-cyan-500/30">
          <span className="text-[8px] font-bold text-cyan-400">💎</span>
        </div>
      )}

      {card.exits.top && (
        <div className="absolute top-0 left-[calc(50%-6px)] w-3 h-1/2 bg-amber-800/70 border-x border-amber-900/40" />
      )}
      {card.exits.bottom && (
        <div className="absolute bottom-0 left-[calc(50%-6px)] w-3 h-1/2 bg-amber-800/70 border-x border-amber-900/40" />
      )}
      {card.exits.left && (
        <div className="absolute left-0 top-[calc(50%-6px)] h-3 w-1/2 bg-amber-800/70 border-y border-amber-900/40" />
      )}
      {card.exits.right && (
        <div className="absolute right-0 top-[calc(50%-6px)] h-3 w-1/2 bg-amber-800/70 border-y border-amber-900/40" />
      )}

      {!isDeadEnd ? (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-amber-800/70 border border-amber-900/40" />
      ) : (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-stone-700 rounded border border-stone-600 flex items-center justify-center">
          <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
        </div>
      )}
    </div>
  );
};