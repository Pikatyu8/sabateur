// src/components/ConnectionScreen.tsx
import React from 'react';
import { motion } from 'motion/react';
import { Pickaxe, User, Plus, ArrowRight } from 'lucide-react';

interface ConnectionScreenProps {
  playerName: string;
  setPlayerName: (val: string) => void;
  joinCode: string;
  setJoinCode: (val: string) => void;
  createRoom: (name: string) => void;
  joinRoom: (code: string, name: string) => void;
  errorMessage: string;
}

export default function ConnectionScreen({
  playerName,
  setPlayerName,
  joinCode,
  setJoinCode,
  createRoom,
  joinRoom,
  errorMessage,
}: ConnectionScreenProps) {
  return (
    <div id="connection-screen" className="min-h-screen bg-stone-950 text-stone-100 font-sans flex flex-col justify-between p-4 selection:bg-amber-800 selection:text-white">
      <header className="max-w-md mx-auto w-full text-center py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-3 mb-2"
        >
          <Pickaxe className="w-10 h-10 text-amber-500 animate-bounce" />
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent font-mono uppercase">
            Гномы-Вредители
          </h1>
        </motion.div>
        <p className="text-stone-500 text-xs font-mono">Сетевой клон легендарной игры Saboteur на PeerJS</p>
      </header>

      <main className="max-w-md mx-auto w-full bg-stone-900 border border-stone-800 rounded-xl p-6 shadow-2xl shadow-black/80 my-auto">
        {errorMessage && (
          <div id="error-message" className="mb-4 bg-red-950/50 border border-red-800 rounded-lg p-3 text-red-300 text-xs font-mono">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="player-name-input" className="block text-xs font-mono uppercase text-stone-400 mb-1.5 tracking-wider">
              Ваше Имя (Гном-никнейм)
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                id="player-name-input"
                type="text"
                maxLength={24}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Гномыч_2000"
                className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-10 pr-4 py-2.5 text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 text-sm transition-all"
              />
            </div>
          </div>

          <div className="h-px bg-stone-800/60 my-2" />

          <div className="flex flex-col gap-3">
            <button
              id="create-room-button"
              disabled={!playerName.trim()}
              onClick={() => createRoom(playerName.trim())}
              className="w-full bg-gradient-to-r from-amber-800 to-amber-900 hover:from-amber-700 hover:to-amber-800 disabled:from-stone-800 disabled:to-stone-900 disabled:text-stone-500 border border-amber-700/40 text-stone-100 font-mono text-sm py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-bold cursor-pointer transition-all disabled:cursor-not-allowed shadow-md"
            >
              <Plus className="w-4 h-4" />
              СОЗДАТЬ НОВУЮ ИГРУ
            </button>

            <div className="flex items-center gap-2 my-1">
              <div className="h-px bg-stone-800/60 flex-1" />
              <span className="text-[10px] font-mono text-stone-500 uppercase">или войти</span>
              <div className="h-px bg-stone-800/60 flex-1" />
            </div>

            <div className="flex gap-2">
              <input
                id="join-code-input"
                type="text"
                maxLength={5}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="КОД"
                className="w-24 bg-stone-950 border border-stone-800 rounded-lg px-3 py-2.5 text-stone-200 placeholder-stone-600 text-center font-mono font-bold text-sm tracking-widest focus:outline-none focus:border-amber-600"
              />
              <button
                id="join-room-button"
                disabled={!playerName.trim() || joinCode.length !== 5}
                onClick={() => joinRoom(joinCode, playerName.trim())}
                className="flex-1 bg-stone-800 hover:bg-stone-700 disabled:bg-stone-900 disabled:text-stone-600 text-stone-200 font-mono text-sm py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 border border-stone-700 cursor-pointer transition-all disabled:cursor-not-allowed"
              >
                ВОЙТИ ПО КОДУ
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center py-6 text-[10px] text-stone-600 font-mono uppercase tracking-wider max-w-md mx-auto w-full">
        Удачи на путях к золоту! ⛏️💎
      </footer>
    </div>
  );
}