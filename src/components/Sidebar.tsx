// src/components/Sidebar.tsx
// src/components/Sidebar.tsx
import React, { useRef, useEffect } from 'react';
import { Users, Coins, ShieldAlert, MessageSquare, Send, List } from 'lucide-react';
import { GameState, NetworkAction } from '../types';

interface SidebarProps {
  activeTab: 'board' | 'players' | 'chat' | 'logs';
  gameState: GameState;
  myPlayerId: string;
  chatInput: string;
  setChatInput: (val: string) => void;
  sendAction: (action: NetworkAction) => void;
}

export default function Sidebar({
  activeTab,
  gameState,
  myPlayerId,
  chatInput,
  setChatInput,
  sendAction,
}: SidebarProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState.logs, activeTab]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendAction({ type: 'SEND_CHAT', payload: { message: chatInput.trim() } });
    setChatInput('');
  };

  const isRoundEnd = gameState.status === 'round_end';
  const isGameEnd = gameState.status === 'game_end';

  return (
    <aside className={`w-full sm:w-80 border-l border-stone-800 bg-stone-900/40 flex flex-col shrink-0 overflow-hidden ${activeTab === 'board' ? 'hidden sm:flex' : 'flex'}`}>
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Список игроков */}
        <div className={`flex-1 flex flex-col overflow-hidden p-3 ${activeTab === 'players' || activeTab === 'board' ? 'flex' : 'hidden sm:flex'}`}>
          <div className="flex justify-between items-center mb-2 text-xs font-mono uppercase text-stone-400 tracking-wider">
            <span>Список гномов ({gameState.players.length}):</span>
            <Users className="w-4 h-4 text-stone-500" />
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {gameState.players.map((p, idx) => {
              const isCurrent = gameState.status === 'playing' && gameState.currentTurn === idx;
              return (
                <div
                  key={p.id}
                  className={`p-2.5 rounded-lg border transition-all ${isCurrent ? 'bg-amber-950/20 border-amber-600/70 shadow shadow-amber-950' : 'bg-stone-950/40 border-stone-800/80'} ${!p.active ? 'opacity-50' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.active ? 'bg-emerald-500' : 'bg-stone-700'}`} />
                      <span className="text-xs font-medium text-stone-200 truncate">
                        {p.name} {p.id === myPlayerId && <span className="text-amber-500 font-mono text-[10px]">(Вы)</span>}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-yellow-500" />
                      <span className="text-xs font-mono font-bold text-yellow-500">{p.score}</span>
                    </div>
                  </div>

                  <div className="mt-1.5 flex flex-wrap justify-between items-center gap-1">
                    <span className="text-[10px] text-stone-500 font-mono">Карт в руке: {p.handSize}</span>
                    <div className="flex gap-1">
                      {p.brokenTools.length === 0 ? (
                        <span className="text-[9px] font-mono text-emerald-500 px-1 bg-emerald-950/30 rounded border border-emerald-900/30">Инструменты ок</span>
                      ) : (
                        p.brokenTools.map(tool => (
                          <span key={tool} className="text-[8px] font-mono uppercase bg-red-950/50 text-red-400 px-1 rounded border border-red-900/50 flex items-center gap-0.5">
                            <ShieldAlert className="w-2.5 h-2.5" />
                            {tool === 'lamp' ? 'Лампа' : tool === 'cart' ? 'Вагонетка' : 'Кирка'}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {(isRoundEnd || isGameEnd) && p.role && (
                    <div className="mt-2 pt-1.5 border-t border-stone-800 flex justify-between items-center text-[10px] font-mono">
                      <span className="text-stone-500">РОЛЬ:</span>
                      {p.role === 'miner' ? (
                        <span className="text-emerald-400 font-bold">⛏️ ЗОЛОТОИСКАТЕЛЬ</span>
                      ) : (
                        <span className="text-red-400 font-bold">👺 ВРЕДИТЕЛЬ</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Чат */}
        <div className={`flex-1 flex flex-col overflow-hidden p-3 border-t border-stone-800 ${activeTab === 'chat' ? 'flex' : 'hidden sm:flex'}`}>
          <div className="flex justify-between items-center mb-1 text-xs font-mono uppercase text-stone-400 tracking-wider shrink-0">
            <span>Общий чат комнаты:</span>
            <MessageSquare className="w-4 h-4 text-stone-500" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 bg-stone-950/60 rounded-lg p-2 border border-stone-800/80 mb-2">
            {gameState.logs
              .filter(log => log.type === 'chat')
              .slice()
              .reverse()
              .map((log) => (
                <div key={log.id} className="text-xs leading-relaxed font-sans">
                  <span className="text-stone-500 text-[10px] font-mono mr-1">[{log.timestamp}]</span>
                  <span className="font-mono font-bold text-amber-500 mr-1.5">{log.playerName}:</span>
                  <span className="text-stone-200">{log.message}</span>
                </div>
              ))}
            {gameState.logs.filter(l => l.type === 'chat').length === 0 && (
              <div className="text-center text-xs font-mono text-stone-600 py-6 uppercase">Чат пуст. Напишите что-нибудь!</div>
            )}
          </div>

          <form onSubmit={handleSendChat} className="flex gap-1.5 shrink-0">
            <input
              type="text"
              maxLength={100}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Напишите гномам..."
              className="flex-1 bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-600 text-sm"
            />
            <button
              type="submit"
              className="p-1.5 bg-amber-800 hover:bg-amber-700 border border-amber-700 rounded-lg text-amber-200 cursor-pointer animate-none"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Системные Логи */}
        <div className={`flex-1 flex flex-col overflow-hidden p-3 border-t border-stone-800 ${activeTab === 'logs' ? 'flex' : 'hidden sm:flex'}`}>
          <div className="flex justify-between items-center mb-1 text-xs font-mono uppercase text-stone-400 tracking-wider shrink-0">
            <span>Журнал событий:</span>
            <List className="w-4 h-4 text-stone-500" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 bg-stone-950/60 rounded-lg p-2 border border-stone-800/80 text-[11px] font-mono">
            {gameState.logs
              .filter(log => log.type !== 'chat')
              .slice()
              .reverse()
              .map((log) => {
                let colorClass = 'text-stone-400';
                if (log.type === 'success') colorClass = 'text-emerald-400 font-bold';
                if (log.type === 'warning') colorClass = 'text-amber-400';
                if (log.type === 'error') colorClass = 'text-red-400';

                return (
                  <div key={log.id} className="leading-snug">
                    <span className="text-stone-600 text-[9px] mr-1">[{log.timestamp}]</span>
                    <span className={colorClass}>{log.message}</span>
                  </div>
                );
              })}
            <div ref={logsEndRef} />
          </div>
        </div>

      </div>
    </aside>
  );
}