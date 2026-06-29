// src/components/ActionCardView.tsx
import React from 'react';
import { ActionCard, ToolType } from '../types';
import { ShieldAlert, ShieldCheck, HelpCircle, Flame, Eye, ShoppingCart, Lightbulb, Hammer } from 'lucide-react';

interface ActionCardViewProps {
  card: ActionCard;
  isSelected?: boolean;
  onClick?: () => void;
}

export const ActionCardView: React.FC<ActionCardViewProps> = ({
  card,
  isSelected = false,
  onClick,
}) => {
  // Base card styling
  const selectClass = isSelected ? 'scale-105 ring-2 ring-amber-400 shadow-lg shadow-amber-400/30' : 'hover:scale-[1.02] shadow-md';

  // Helper to get the correct tool icon
  const getToolIcon = (tool?: ToolType, sizeClass = 'w-8 h-8') => {
    if (tool === 'lamp') return <Lightbulb className={sizeClass} />;
    if (tool === 'cart') return <ShoppingCart className={sizeClass} />;
    return <Hammer className={sizeClass} />; // pickaxe fallback
  };

  const getToolNameRu = (tool?: ToolType) => {
    if (tool === 'lamp') return 'Фонарь';
    if (tool === 'cart') return 'Вагонетка';
    return 'Кирка';
  };

  // 1. BREAK TOOL CARD
  if (card.actionType === 'break_tool') {
    return (
      <div
        id={`card-action-${card.id}`}
        className={`relative w-16 h-24 rounded-lg bg-gradient-to-br from-red-950 via-stone-900 to-red-950 border border-red-800 p-1 select-none overflow-hidden flex flex-col justify-between items-center transition-all duration-200 cursor-pointer ${selectClass}`}
        onClick={onClick}
      >
        <span className="text-[8px] text-red-500 font-bold uppercase tracking-widest text-center">СЛОМАТЬ</span>
        <div className="relative my-1 text-red-500">
          {getToolIcon(card.toolType)}
          <ShieldAlert className="w-4 h-4 text-red-400 absolute -bottom-1 -right-1 bg-stone-900 rounded-full" />
        </div>
        <span className="text-[8px] text-red-300 font-mono text-center leading-none truncate max-w-full">
          {getToolNameRu(card.toolType)}
        </span>
      </div>
    );
  }

  // 2. REPAIR TOOL CARD
  if (card.actionType === 'repair_tool') {
    const isMulti = !!card.repairTypes;
    return (
      <div
        id={`card-action-${card.id}`}
        className={`relative w-16 h-24 rounded-lg bg-gradient-to-br from-emerald-950 via-stone-900 to-emerald-950 border border-emerald-800 p-1 select-none overflow-hidden flex flex-col justify-between items-center transition-all duration-200 cursor-pointer ${selectClass}`}
        onClick={onClick}
      >
        <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-widest text-center">ПОЧИНИТЬ</span>
        <div className="relative my-1 text-emerald-400 flex gap-0.5">
          {isMulti ? (
            <div className="flex gap-0.5 items-center">
              {card.repairTypes?.map(t => (
                <div key={t} className="scale-75 -mx-1">
                  {getToolIcon(t, 'w-6 h-6')}
                </div>
              ))}
            </div>
          ) : (
            getToolIcon(card.toolType)
          )}
          <ShieldCheck className="w-4 h-4 text-emerald-300 absolute -bottom-1 -right-1 bg-stone-900 rounded-full" />
        </div>
        <span className="text-[8px] text-emerald-200 font-mono text-center leading-none truncate max-w-full">
          {isMulti ? 'Двойная' : getToolNameRu(card.toolType)}
        </span>
      </div>
    );
  }

  // 3. CAVE-IN CARD (ОБВАЛ)
  if (card.actionType === 'cave_in') {
    return (
      <div
        id={`card-action-${card.id}`}
        className={`relative w-16 h-24 rounded-lg bg-gradient-to-br from-amber-950 via-stone-900 to-amber-900 border border-amber-600 p-1 select-none overflow-hidden flex flex-col justify-between items-center transition-all duration-200 cursor-pointer ${selectClass}`}
        onClick={onClick}
      >
        <span className="text-[8px] text-amber-500 font-bold uppercase tracking-widest text-center">ОБВАЛ</span>
        <div className="relative my-1 text-amber-500">
          <Flame className="w-8 h-8 animate-pulse text-amber-500" />
        </div>
        <span className="text-[8px] text-amber-200 font-mono text-center leading-none truncate max-w-full">
          Взрыв туннеля
        </span>
      </div>
    );
  }

  // 4. MAP CARD (КАРТА)
  if (card.actionType === 'map') {
    return (
      <div
        id={`card-action-${card.id}`}
        className={`relative w-16 h-24 rounded-lg bg-gradient-to-br from-sky-950 via-stone-900 to-indigo-950 border border-sky-800 p-1 select-none overflow-hidden flex flex-col justify-between items-center transition-all duration-200 cursor-pointer ${selectClass}`}
        onClick={onClick}
      >
        <span className="text-[8px] text-sky-400 font-bold uppercase tracking-widest text-center">КАРТА</span>
        <div className="relative my-1 text-sky-400">
          <Eye className="w-8 h-8 text-sky-400" />
        </div>
        <span className="text-[8px] text-sky-200 font-mono text-center leading-none truncate max-w-full">
          Узнать цель
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative w-16 h-24 rounded-lg bg-stone-800 border border-stone-700 flex items-center justify-center cursor-pointer ${selectClass}`}
      onClick={onClick}
    >
      <HelpCircle className="w-8 h-8 text-stone-500" />
    </div>
  );
};
