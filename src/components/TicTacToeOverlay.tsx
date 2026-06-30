// src/components/TicTacToeOverlay.tsx
import React from 'react';
import { GameState, NetworkAction } from '../types';

interface TTTProps {
  gameState: GameState;
  myPlayerId: string;
  sendAction: (action: NetworkAction) => void;
}

export default function TicTacToeOverlay({ gameState, myPlayerId, sendAction }: TTTProps) {
  const ttt = gameState.tttState;
  if (!ttt || !ttt.active) return null;

  const challenger = gameState.players.find(p => p.id === ttt.challengerId);
  const target = gameState.players.find(p => p.id === ttt.targetId);
  const isMyTurn = ttt.currentTurnId === myPlayerId;
  const isParticipant = myPlayerId === ttt.challengerId || myPlayerId === ttt.targetId;

  const handleCellClick = (idx: number) => {
    if (!isMyTurn || ttt.board[idx] !== null || ttt.isSpinningWheel) return;
    sendAction({ type: 'TTT_MOVE', payload: { cellIndex: idx } });
  };

  return (
    <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-50 p-4">
      <div className="max-w-md w-full bg-stone-900 border-2 border-yellow-500/60 rounded-2xl p-6 shadow-2xl text-center">
        <h2 className="text-xl font-bold font-mono text-yellow-500 uppercase tracking-widest mb-4">
          ⚔️ Идет дуэль на золото! ⚔️
        </h2>

        <div className="flex justify-between items-center bg-stone-950 p-3 rounded-lg border border-stone-800 mb-4">
          <div className="text-left">
            <p className="text-xs text-stone-500 font-mono">Вызывающий</p>
            <p className="text-sm font-bold text-stone-200">{challenger?.name} (X)</p>
          </div>
          <div className="bg-yellow-950/80 px-3 py-1.5 rounded-full border border-yellow-600 font-bold text-lg text-yellow-400">
            {ttt.timeLeft}s
          </div>
          <div className="text-right">
            <p className="text-xs text-stone-500 font-mono">Защищающийся</p>
            <p className="text-sm font-bold text-stone-200">{target?.name} (O)</p>
          </div>
        </div>

        {ttt.isSpinningWheel ? (
          <div className="my-8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-dashed border-yellow-500 animate-spin" />
            <p className="text-sm font-mono text-yellow-500 animate-pulse uppercase">
              🎡 Колесо Фортуны крутится...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto my-6">
            {ttt.board.map((cell, idx) => (
              <button
                key={idx}
                disabled={!isMyTurn}
                onClick={() => handleCellClick(idx)}
                className={`w-[70px] h-[70px] rounded-lg border-2 text-2xl font-bold flex items-center justify-center font-mono transition-all
                  ${cell === null ? 'bg-stone-950 hover:bg-stone-800 border-stone-800' : 'bg-stone-800 border-stone-700'}
                  ${cell === 'X' ? 'text-blue-400' : cell === 'O' ? 'text-red-400' : ''}
                  ${isMyTurn && cell === null ? 'cursor-pointer hover:border-yellow-500' : 'cursor-not-allowed'}
                `}
              >
                {cell}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4">
          {ttt.isSpinningWheel ? (
            <p className="text-xs font-mono text-stone-400">Ожидайте, судьба решает исход дуэли!</p>
          ) : isMyTurn ? (
            <p className="text-sm font-mono font-bold text-emerald-400 animate-pulse uppercase">★ Ваш ход!</p>
          ) : isParticipant ? (
            <p className="text-sm font-mono text-stone-400">Ход соперника...</p>
          ) : (
            <p className="text-xs font-mono text-stone-500 uppercase">Вы наблюдаете за этой дуэлью</p>
          )}
        </div>
      </div>
    </div>
  );
}