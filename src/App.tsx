// src/App.tsx
import React, { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { usePeerGame } from './peerManager';

import ConnectionScreen from './components/ConnectionScreen';
import LobbyScreen from './components/LobbyScreen';
import BoardCanvas from './components/BoardCanvas';
import Sidebar from './components/Sidebar';
import ActionHUD from './components/ActionHUD';
import VictoryOverlays from './components/VictoryOverlays';
import TicTacToeOverlay from './components/TicTacToeOverlay';

export default function App() {
  const {
    isHost,
    roomCode,
    connectionStatus,
    errorMessage,
    gameState,
    myPlayerId,
    createRoom,
    joinRoom,
    sendAction,
  } = usePeerGame();

  const [playerName, setPlayerName] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [scale, setScale] = useState<number>(0.7); 
  const [isRotated, setIsRotated] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'board' | 'players' | 'chat' | 'logs'>('board');
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
    return (
      <ConnectionScreen
        playerName={playerName}
        setPlayerName={setPlayerName}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        createRoom={createRoom}
        joinRoom={joinRoom}
        errorMessage={errorMessage}
      />
    );
  }

  if (connectionStatus === 'connecting') {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-stone-400 font-mono gap-4">
        <RefreshCw className="w-10 h-10 text-amber-500 animate-spin" />
        <span className="text-xs uppercase tracking-widest animate-pulse">Соединение по WebRTC...</span>
      </div>
    );
  }

  if (gameState && gameState.status === 'lobby') {
    return (
      <LobbyScreen
        roomCode={roomCode}
        gameState={gameState}
        myPlayerId={myPlayerId}
        isHost={isHost}
        copied={copied}
        handleCopyCode={handleCopyCode}
        sendAction={sendAction}
      />
    );
  }

  if (gameState) {
    const me = gameState.players.find(p => p.id === myPlayerId);
    const activePlayer = gameState.players[gameState.currentTurn];
    const isMyTurn = activePlayer?.id === myPlayerId;
    const selectedCard = (selectedCardIds.length === 1 && me)
      ? (me.hand.find(c => c.id === selectedCardIds[0]) || null)
      : null;

    return (
      <div className="h-screen max-h-screen bg-stone-950 text-stone-100 font-sans flex flex-col overflow-hidden relative">
        
        {/* Интеграция оверлея дуэли Крестики-Нолики */}
        {gameState.tttState?.active && (
          <TicTacToeOverlay
            gameState={gameState}
            myPlayerId={myPlayerId}
            sendAction={sendAction}
          />
        )}

        <header className="bg-stone-900/90 border-b border-stone-800 p-3 flex justify-between items-center shrink-0 z-30 sticky top-0 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-stone-950 px-2.5 py-1 rounded border border-stone-800">
              <span className="text-[10px] font-mono text-stone-500 uppercase">КОД:</span>
              <span className="text-sm font-mono font-bold text-amber-500 tracking-wider cursor-pointer" onClick={handleCopyCode}>
                {roomCode}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-stone-950 px-2 py-0.5 rounded border border-stone-800 text-xs font-mono text-stone-400">
              <span>Раунд {gameState.round}/3</span>
              <span className="text-stone-700">|</span>
              <span>Лимит карт: {me?.maxHandSize}</span>
            </div>

            {/* Косметика: Красная пульсирующая надпись "Ваш ход" при активном ходе игрока */}
            {isMyTurn && (
              <span className="text-red-500 font-bold font-mono text-xs animate-pulse uppercase border border-red-500/30 px-2.5 py-1 rounded bg-red-950/20 shrink-0">
                ★ ВАШ ХОД!
              </span>
            )}
          </div>

          {me && me.role && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border bg-stone-950 text-xs font-medium">
              <span className="text-stone-500 font-mono text-[10px] uppercase">РОЛЬ:</span>
              {me.role === 'miner' ? (
                <span className="text-emerald-400 font-mono">⛏️ Шахтер</span>
              ) : me.role === 'geologist' ? (
                <span className="text-cyan-400 font-mono">💎 Геолог</span>
              ) : (
                <span className="text-red-400 font-mono">👺 Вредитель</span>
              )}
            </div>
          )}

          <div className="flex sm:hidden gap-1 bg-stone-950 p-0.5 rounded-lg border text-[10px] font-mono uppercase">
            {['board', 'players', 'chat', 'logs'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-2 py-1 rounded-md transition-all ${activeTab === tab ? 'bg-amber-800 text-stone-100' : 'text-stone-400'}`}
              >
                {tab === 'board' ? 'Поле' : tab === 'players' ? 'Гномы' : tab === 'chat' ? 'Чат' : 'Логи'}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden relative">
          <main className={`flex-1 flex flex-col p-3 overflow-hidden ${activeTab === 'board' ? 'block' : 'hidden sm:flex'}`}>
            <div className="mb-2 flex flex-wrap gap-2 justify-between items-center text-xs font-mono shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-500">Ход:</span>
                  <span className={`px-2 py-0.5 rounded font-bold ${isMyTurn ? 'bg-amber-500 text-stone-950 animate-pulse' : 'bg-stone-900 text-amber-500 border border-stone-800'}`}>
                    {activePlayer?.name} {isMyTurn && '(Вы)'}
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-stone-900/60 border border-stone-800 rounded-md p-1">
                  <button onClick={() => setScale(prev => Math.max(0.15, prev - 0.05))} className="px-1.5 bg-stone-950 border border-stone-800 rounded text-stone-300">-</button>
                  <span className="text-[10px] font-mono text-amber-500 font-bold min-w-[32px] text-center">{Math.round(scale * 100)}%</span>
                  <button onClick={() => setScale(prev => Math.min(1.5, prev + 0.05))} className="px-1.5 bg-stone-950 border border-stone-800 rounded text-stone-300">+</button>
                </div>

                {gameState.massActionState?.active && (
                  <span className="text-yellow-400 font-bold animate-pulse text-[10px] uppercase font-mono">
                    ⚠️ Серия ходов: {gameState.massActionState.type.toUpperCase()}
                  </span>
                )}
              </div>

              {selectedCardIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-stone-500">Выбрано: {selectedCardIds.length}</span>
                  {selectedCardIds.length === 1 && selectedCard?.type === 'tunnel' && (
                    <button onClick={() => setIsRotated(!isRotated)} className="px-2 py-1 bg-amber-900 border rounded text-[10px] text-amber-200">Повернуть</button>
                  )}
                  <button onClick={() => setSelectedCardIds([])} className="p-1 hover:bg-stone-800 text-stone-400"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>

            <BoardCanvas
              gameState={gameState}
              myPlayerId={myPlayerId}
              selectedCardIds={selectedCardIds}
              setSelectedCardIds={setSelectedCardIds}
              scale={scale}
              isRotated={isRotated}
              sendAction={sendAction}
            />
          </main>

          <Sidebar
            activeTab={activeTab}
            gameState={gameState}
            myPlayerId={myPlayerId}
            chatInput={chatInput}
            setChatInput={setChatInput}
            sendAction={sendAction}
          />
        </div>

        <ActionHUD
          gameState={gameState}
          myPlayerId={myPlayerId}
          selectedCardIds={selectedCardIds}
          setSelectedCardIds={setSelectedCardIds}
          isRotated={isRotated}
          setIsRotated={setIsRotated}
          sendAction={sendAction}
        />

        <VictoryOverlays
          gameState={gameState}
          isHost={isHost}
          sendAction={sendAction}
        />
      </div>
    );
  }

  return null;
}