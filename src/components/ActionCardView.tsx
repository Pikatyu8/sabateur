// src/components/ActionCardView.tsx
import React from 'react';
import { ActionCard, ToolType } from '../types';
import { ShieldAlert, ShieldCheck, HelpCircle, Flame, Eye, ShoppingCart, Lightbulb, Hammer, Users, RefreshCw, Trophy } from 'lucide-react';

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
  const selectClass = isSelected ? 'scale-105 ring-2 ring-amber-400 shadow-lg' : 'hover:scale-[1.02] shadow-md';

  const getToolIcon = (tool?: ToolType) => {
    if (tool === 'lamp') return <Lightbulb className="w-8 h-8" />;
    if (tool === 'cart') return <ShoppingCart className="w-8 h-8" />;
    return <Hammer className="w-8 h-8" />;
  };

  const wrapCard = (bg: string, label: string, icon: React.ReactNode, sub: string) => (
    <div
      className={`relative w-16 h-24 rounded-lg bg-gradient-to-br ${bg} border p-1 select-none flex flex-col justify-between items-center transition-[transform,shadow] duration-200 cursor-pointer ${selectClass}`}
      onClick={onClick}
    >
      <span className="text-[8px] font-bold uppercase tracking-widest text-center">{label}</span>
      <div className="relative my-1">{icon}</div>
      <span className="text-[8px] font-mono text-center leading-none truncate max-w-full">{sub}</span>
    </div>
  );

  if (card.actionType === 'break_tool') {
    return wrapCard('from-red-950 via-stone-900 to-red-950 border-red-800 text-red-500', 'СЛОМАТЬ', getToolIcon(card.toolType), card.toolType || 'Инструмент');
  }

  if (card.actionType === 'repair_tool') {
    return wrapCard('from-emerald-950 via-stone-900 to-emerald-950 border-emerald-800 text-emerald-400', 'ПОЧИНИТЬ', getToolIcon(card.toolType), 'Ремонт');
  }

  if (card.actionType === 'cave_in') {
    return wrapCard('from-amber-950 via-stone-900 to-amber-900 border-amber-600 text-amber-500', 'ОБВАЛ', <Flame className="w-8 h-8" />, 'Взрыв');
  }

  if (card.actionType === 'map') {
    return wrapCard('from-sky-950 via-stone-900 to-indigo-950 border-sky-800 text-sky-400', 'КАРТА', <Eye className="w-8 h-8" />, 'Узнать цель');
  }

  if (card.actionType === 'view_role') {
    return wrapCard('from-indigo-950 via-stone-900 to-purple-950 border-indigo-800 text-indigo-400', 'РОЛЬ', <Users className="w-8 h-8" />, 'Узнать роль');
  }

  if (card.actionType === 'swap_roles') {
    return wrapCard('from-pink-950 via-stone-900 to-rose-950 border-pink-800 text-pink-400', 'СМЕНА', <RefreshCw className="w-8 h-8 text-pink-400" />, 'Роль');
  }

  if (card.actionType === 'swap_cards') {
    return wrapCard('from-teal-950 via-stone-900 to-emerald-950 border-teal-800 text-teal-400', 'ОБМЕН', <Users className="w-8 h-8 text-teal-400" />, 'Карты рук');
  }

  if (card.actionType === 'tic_tac_toe') {
    return wrapCard('from-yellow-950 via-stone-900 to-amber-950 border-yellow-700 text-yellow-500', 'ДУЭЛЬ', <Trophy className="w-8 h-8" />, `${card.tttDuration} сек`);
  }

  return (
    <div className={`relative w-16 h-24 rounded-lg bg-stone-800 border flex items-center justify-center cursor-pointer transition-[transform,shadow] duration-200 ${selectClass}`} onClick={onClick}>
      <HelpCircle className="w-8 h-8 text-stone-500" />
    </div>
  );
};