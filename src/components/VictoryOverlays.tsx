// src/components/VictoryOverlays.tsx
// src/components/VictoryOverlays.tsx
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Sparkles, Coins } from 'lucide-react';
import { GameState, NetworkAction } from '../types';

interface VictoryOverlaysProps {
  gameState: GameState;
  isHost: boolean;
  sendAction: (action: NetworkAction) => void;
}

export default function VictoryOverlays({
  gameState,
  isHost,
  sendAction,
}: VictoryOverlaysProps) {
  const isRoundEnd = gameState.status === 'round_end';
  const isGameEnd = gameState.status === 'game_end';

  return (
    <>
      <AnimatePresence>
        {isRoundEnd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full bg-stone-900 border-2 border-amber-600/60 rounded-xl p-6 shadow-2xl shadow-black text-center"
            >
              <div className="flex justify-center mb-3">
                <Trophy className="w-12 h-12 text-yellow-500 animate-bounce" />
              </div>

              <h3 className="text-xl font-bold font-mono tracking-wider uppercase mb-1">Раунд Завершен</h3>
              {gameState.winnerTeam === 'miners' ? (
                <p className="text-2xl font-bold text-emerald-400 font-mono uppercase tracking-wide">
                  🎉 Шахтеры Победили!
                </p>
              ) : (
                <p className="text-2xl font-bold text-red-400 font-mono uppercase tracking-wide">
                  👺 Вредители Победили!
                </p>
              )}

              <div className="my-5 p-3 bg-stone-950 border border-stone-800 rounded-lg">
                <span className="text-xs font-mono text-stone-500 uppercase tracking-widest block mb-2">Начисление золота:</span>
                <div className="divide-y divide-stone-900 space-y-1.5 text-xs font-mono text-stone-300 text-left">
                  {gameState.players.map(p => {
                    const wonGold = gameState.roundGoldReward?.[p.id] || 0;
                    return (
                      <div key={p.id} className="pt-1.5 flex justify-between items-center">
                        <span>
                          {p.name}{' '}
                          <span className="text-[10px] text-stone-500">
                            ({p.role === 'miner' ? 'Шахтер ⛏️' : 'Вредитель 👺'})
                          </span>
                        </span>
                        <span className="text-yellow-500 font-bold">+{wonGold} 🪙</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {isHost ? (
                <button
                  id="next-round-button"
                  onClick={() => sendAction({ type: 'NEXT_ROUND' })}
                  className="w-full bg-gradient-to-r from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-stone-100 font-mono text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold cursor-pointer"
                >
                  {gameState.round >= 3 ? 'К РЕЗУЛЬТАТАМ ИГРЫ' : 'СЛЕДУЮЩИЙ РАУНД'}
                </button>
              ) : (
                <p className="text-xs font-mono text-stone-500 animate-pulse uppercase">Ожидайте, пока хост запустит следующий раунд...</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGameEnd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full bg-stone-900 border-2 border-yellow-400 rounded-xl p-6 shadow-2xl shadow-yellow-500/10 text-center"
            >
              <div className="flex justify-center mb-3 text-yellow-500">
                <Sparkles className="w-14 h-14 animate-pulse" />
              </div>

              <h3 className="text-2xl font-bold font-mono tracking-widest text-amber-400 uppercase mb-2">ИГРА ЗАВЕРШЕНА!</h3>
              <p className="text-sm font-mono text-stone-400 uppercase tracking-wider mb-5">Победители по итогам 3-х раундов:</p>

              <div className="bg-stone-950 border border-stone-800 rounded-lg p-3 divide-y divide-stone-900 mb-6 text-left font-mono">
                {gameState.players
                  .slice()
                  .sort((a, b) => b.score - a.score)
                  .map((p, idx) => (
                    <div key={p.id} className="py-2 flex justify-between items-center">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-stone-500 font-bold">{idx + 1}.</span>
                        <span className="text-stone-200 text-sm truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 text-yellow-500 font-bold">
                        <Coins className="w-4 h-4" />
                        <span>{p.score} золота</span>
                      </div>
                    </div>
                  ))}
              </div>

              {isHost ? (
                <button
                  id="restart-game-button"
                  onClick={() => sendAction({ type: 'RESTART_GAME' })}
                  className="w-full bg-gradient-to-r from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-stone-100 font-mono text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold cursor-pointer"
                >
                  НАЧАТЬ НОВУЮ ИГРУ
                </button>
              ) : (
                <p className="text-xs font-mono text-stone-500 animate-pulse uppercase">Ожидайте, пока хост начнет новую партию...</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}