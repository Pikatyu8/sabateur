// src/components/LobbyScreen.tsx
import React from 'react';
import { Users, Copy, Play } from 'lucide-react';
import { GameState, NetworkAction } from '../types';

interface LobbyScreenProps {
  roomCode: string;
  gameState: GameState;
  myPlayerId: string;
  isHost: boolean;
  copied: boolean;
  handleCopyCode: () => void;
  sendAction: (action: NetworkAction) => void;
}

export default function LobbyScreen({
  roomCode,
  gameState,
  myPlayerId,
  isHost,
  copied,
  handleCopyCode,
  sendAction,
}: LobbyScreenProps) {
  return (
    <div id="lobby-screen" className="min-h-screen bg-stone-950 text-stone-100 font-sans flex flex-col justify-between p-4">
      <header className="max-w-md mx-auto w-full py-4 text-center">
        <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/30">
          Игровое лобби
        </span>
        <h2 className="text-2xl font-bold font-mono text-stone-300 mt-2">Ожидание игроков</h2>
      </header>

      <main className="max-w-md mx-auto w-full bg-stone-900 border border-stone-800 rounded-xl p-6 shadow-2xl shadow-black my-auto flex flex-col gap-6">
        <div className="bg-stone-950 border border-stone-800 rounded-lg p-4 flex flex-col items-center gap-1 relative overflow-hidden">
          <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">Поделитесь кодом для подключения:</span>
          <div className="flex items-center gap-3">
            <span id="room-code-display" className="text-3xl font-mono font-bold tracking-widest text-amber-400">{roomCode}</span>
            <button
              id="copy-code-button"
              onClick={handleCopyCode}
              className="p-1.5 hover:bg-stone-800 rounded text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
              title="Копировать код"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          {copied && (
            <span className="text-[9px] font-mono text-emerald-400 animate-fade-in">Код скопирован в буфер!</span>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-mono uppercase text-stone-400 tracking-wider">Присоединились ({gameState.players.length}/10):</span>
            <Users className="w-4 h-4 text-stone-500" />
          </div>

          <div className="bg-stone-950 border border-stone-800 rounded-lg divide-y divide-stone-800 max-h-48 overflow-y-auto">
            {gameState.players.map((p) => (
              <div key={p.id} className="p-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-medium text-stone-200">
                    {p.name} {p.id === myPlayerId && <span className="text-amber-500 font-mono text-xs">(Вы)</span>}
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-stone-900 text-stone-500 border border-stone-800">
                  {p.isHost ? 'Хост' : 'Клиент'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button
            id="start-game-button"
            disabled={gameState.players.length < 2}
            onClick={() => sendAction({ type: 'START_GAME' })}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 disabled:from-stone-800 disabled:to-stone-900 disabled:text-stone-500 border border-amber-600/40 text-stone-100 font-mono text-sm py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-bold cursor-pointer transition-all disabled:cursor-not-allowed shadow-md shadow-amber-950/30"
          >
            <Play className="w-4 h-4" />
            НАЧАТЬ ИГРУ
          </button>
        ) : (
          <div className="text-center text-xs font-mono text-stone-500 animate-pulse py-2">
            Ожидайте, пока хост начнет игру...
          </div>
        )}
      </main>

      <footer className="text-center py-4 text-[10px] text-stone-600 font-mono">
        Готовы прокладывать пути к сокровищам? ⛏️
      </footer>
    </div>
  );
}