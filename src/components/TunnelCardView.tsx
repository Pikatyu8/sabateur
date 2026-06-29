import React from 'react';
import { TunnelCard } from '../types';
import { Pickaxe, Flame, Coins, HelpCircle, Layers, ShieldAlert, Eye } from 'lucide-react';

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
  // Base card styling
  const baseClass = `relative w-16 h-24 rounded-lg flex flex-col justify-between p-1 select-none overflow-hidden transition-all duration-200 cursor-pointer text-xs
    ${preview ? 'opacity-60 border-2 border-dashed border-emerald-400 bg-stone-800/80' : ''}
    ${isSelected ? 'scale-105 ring-2 ring-amber-400 shadow-lg shadow-amber-400/30' : 'hover:scale-[1.02] shadow-md'}
  `;

  // 1. Закрытая карта цели (только если она не проложена туннелем И не раскрыта тайно через карту «Секретная карта»)
  if (isGoal && !flipped && card.id === 'goal_hidden') {
    return (
      <div
        id={`card-goal-hidden-${card.id}`}
        className={`${baseClass} bg-gradient-to-br from-stone-800 to-amber-950 border-2 border-amber-800/60 flex items-center justify-center`}
        onClick={onClick}
      >
        <div className="absolute inset-1 rounded border border-amber-900/30 flex flex-col items-center justify-center gap-1">
          <HelpCircle className="w-6 h-6 text-amber-700 animate-pulse" />
          <span className="font-mono text-[9px] text-amber-700/80 uppercase tracking-widest font-bold">Цель</span>
        </div>
      </div>
    );
  }

  // 2. Раскрытая золотая жила (показана, если проложен туннель ИЛИ если игрок тайно посмотрел её)
  if (isGoal && (flipped || card.id !== 'goal_hidden') && isGold) {
    return (
      <div
        id={`card-goal-gold-${card.id}`}
        className={`${baseClass} bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 border-2 border-yellow-300 text-stone-900 shadow-xl shadow-yellow-500/20`}
        onClick={onClick}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-300/40 via-transparent to-transparent animate-pulse" />
        <div className="absolute inset-1 rounded border border-yellow-200/40 flex flex-col items-center justify-center gap-1 bg-yellow-950/10">
          <Coins className="w-8 h-8 text-yellow-100 drop-shadow-md animate-bounce" />
          <span className="font-sans text-[8px] text-yellow-100 font-bold uppercase tracking-wider bg-amber-950/40 px-1 rounded text-center">
            {flipped ? 'ЗОЛОТО!' : 'ТАЙНОЕ ЗОЛОТО'}
          </span>
          {/* Значок глаза указывает, что карта подсмотрена тайно и другие игроки её не видят */}
          {!flipped && (
            <div className="absolute top-1 right-1 p-0.5 bg-stone-950/80 rounded border border-amber-500/30">
              <Eye className="w-3 h-3 text-amber-400" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Раскрытый пустой камень (показан, если проложен туннель ИЛИ если игрок тайно посмотрел его)
  if (isGoal && (flipped || card.id !== 'goal_hidden') && !isGold) {
    return (
      <div
        id={`card-goal-stone-${card.id}`}
        className={`${baseClass} bg-gradient-to-br from-stone-700 to-stone-900 border-2 border-stone-600 text-stone-400`}
        onClick={onClick}
      >
        <div className="absolute inset-1 rounded border border-stone-600/30 flex flex-col items-center justify-center gap-1 bg-black/15">
          <Layers className="w-7 h-7 text-stone-500" />
          <span className="font-sans text-[8px] text-stone-400 font-bold uppercase tracking-wider text-center">
            {flipped ? 'Камень' : 'Тайный камень'}
          </span>
          {!flipped && (
            <div className="absolute top-1 right-1 p-0.5 bg-stone-950/80 rounded border border-stone-500/30">
              <Eye className="w-3 h-3 text-stone-400" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. Entrance Card
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
          <div className="flex flex-col gap-0.5 w-4 items-center">
            <div className="h-0.5 w-full bg-amber-600" />
            <div className="h-0.5 w-full bg-amber-600" />
            <div className="h-0.5 w-full bg-amber-600" />
            <div className="h-0.5 w-full bg-amber-600" />
            <div className="h-0.5 w-full bg-amber-600" />
            <div className="h-0.5 w-full bg-amber-600" />
          </div>
          <Pickaxe className="w-3 h-3 text-amber-500" />
        </div>
      </div>
    );
  }

  // 5. Normal Tunnel Card
  const isDeadEnd = card.connectedParts.every(part => part.length === 1);
  const rotationClass = rotated ? 'rotate-180' : '';

  return (
    <div
      id={`card-${card.id}`}
      className={`${baseClass} bg-stone-900 border border-stone-800/80 text-stone-300 ${rotationClass}`}
      onClick={onClick}
    >
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />

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

      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-stone-500 font-mono tracking-tighter truncate max-w-full px-0.5 bg-stone-950/60 rounded">
        {isDeadEnd ? 'Тупик' : 'Путь'}
      </div>
    </div>
  );
};