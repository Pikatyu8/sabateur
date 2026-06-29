// src/App.tsx
import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePeerGame } from './peerManager';

// Импорт новых разделенных компонентов
import ConnectionScreen from './components/ConnectionScreen';
import LobbyScreen from './components/LobbyScreen';
import BoardCanvas from './components/BoardCanvas';
import Sidebar from './components/Sidebar';
import ActionHUD from './components/ActionHUD';
import VictoryOverlays from './components/VictoryOverlays';

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

  // Локальные состояния интерфейса
  const [playerName, setPlayerName] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [scale, setScale] = useState<number>(0.85); // Масштаб по умолчанию увеличен для удобства
  const [isRotated, setIsRotated] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'board' | 'players' | 'chat' | 'logs'>('board');
  const [copied, setCopied] = useState<boolean>(false);

  // Копирование кода комнаты
  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ЭКРАН ПОДКЛЮЧЕНИЯ
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

  // ЗАГРУЗКА WEBRTC
  if (connectionStatus === 'connecting') {
    return (
      <div id="connecting-state" className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-stone-400 font-mono gap-4">
        <RefreshCw className="w-10 h-10 text-amber-500 animate-spin" />
        <span className="text-xs uppercase tracking-widest animate-pulse">Установка WebRTC соединения...</span>
      </div>
    );
  }

  // ЛОББИ ИГРЫ
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

  // АКТИВНАЯ ИГРОВАЯ СЕССИЯ
  if (gameState) {
    const me = gameState.players.find(p => p.id === myPlayerId);
    const activePlayer = gameState.players[gameState.currentTurn];
    const isMyTurn = activePlayer?.id === myPlayerId;
    const selectedCard = (selectedCardIds.length === 1 && me)
      ? (me.hand.find(c => c.id === selectedCardIds[0]) || null)
      : null;

    return (
      <div id="game-arena" className="min-h-screen bg-stone-950 text-stone-100 font-sans flex flex-col selection:bg-amber-800">
        
        {/* Шапка игры */}
        <header className="bg-stone-900/90 border-b border-stone-800 p-3 flex justify-between items-center shrink-0 z-30 sticky top-0 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-stone-950 px-2.5 py-1 rounded border border-stone-800">
              <span className="text-[10px] font-mono text-stone-500 uppercase">КОД:</span>
              <span id="game-room-code" className="text-sm font-mono font-bold text-amber-500 tracking-wider cursor-pointer" onClick={handleCopyCode}>
                {roomCode}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-stone-950 px-2 py-0.5 rounded border border-stone-800/60 text-xs font-mono text-stone-400">
              <span>Раунд {gameState.round}/3</span>
              <span className="text-stone-700">|</span>
              <span>Колода: {gameState.deckCount}</span>
            </div>
          </div>

          {/* Текущая секретная роль на верхней панели */}
          {me && me.role && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border bg-stone-950 text-xs font-medium max-w-[180px] sm:max-w-none">
              <span className="text-stone-500 font-mono text-[10px] uppercase">РОЛЬ:</span>
              {me.role === 'miner' ? (
                <span className="text-emerald-400 flex items-center gap-1 font-mono">⛏️ Шахтер</span>
              ) : (
                <span className="text-red-400 flex items-center gap-1 font-mono">👺 Вредитель</span>
              )}
            </div>
          )}

          {/* Табы управления для мобильных устройств */}
          <div className="flex sm:hidden gap-1 bg-stone-950 p-0.5 rounded-lg border border-stone-800 text-[10px] font-mono uppercase">
            <button
              onClick={() => setActiveTab('board')}
              className={`px-2 py-1 rounded-md transition-all ${activeTab === 'board' ? 'bg-amber-800 text-stone-100' : 'text-stone-400'}`}
            >
              Поле
            </button>
            <button
              onClick={() => setActiveTab('players')}
              className={`px-2 py-1 rounded-md transition-all ${activeTab === 'players' ? 'bg-amber-800 text-stone-100' : 'text-stone-400'}`}
            >
              Гномы
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-2 py-1 rounded-md transition-all ${activeTab === 'chat' ? 'bg-amber-800 text-stone-100' : 'text-stone-400'}`}
            >
              Чат
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-2 py-1 rounded-md transition-all ${activeTab === 'logs' ? 'bg-amber-800 text-stone-100' : 'text-stone-400'}`}
            >
              Логи
            </button>
          </div>
        </header>

        {/* Основная рабочая область */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* Левая часть: Игровое поле */}
          <main className={`flex-1 flex flex-col p-3 overflow-hidden ${activeTab === 'board' ? 'block' : 'hidden sm:flex'}`}>
            <div className="mb-2 flex flex-wrap gap-2 justify-between items-center text-xs font-mono shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-500">Ход:</span>
                  <span className={`px-2 py-0.5 rounded font-bold ${isMyTurn ? 'bg-amber-500 text-stone-950 animate-pulse' : 'bg-stone-900 text-amber-500 border border-stone-800'}`}>
                    {activePlayer?.name} {isMyTurn && '(Вы)'}
                  </span>
                </div>

                {/* Блок изменения масштаба */}
                <div className="flex items-center gap-1 bg-stone-900/60 border border-stone-800 rounded-md p-1">
                  <button
                    type="button"
                    onClick={() => setScale(prev => Math.max(0.15, prev - 0.05))}
                    className="p-0.5 px-1.5 bg-stone-950 hover:bg-stone-800 border border-stone-800 rounded text-stone-300 font-mono text-[10px] cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-[10px] font-mono text-amber-500 font-bold min-w-[32px] text-center">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setScale(prev => Math.min(1.5, Math.max(0.15, prev + 0.05)))}
                    className="p-0.5 px-1.5 bg-stone-950 hover:bg-stone-800 border border-stone-800 rounded text-stone-300 font-mono text-[10px] cursor-pointer"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setScale(0.85)}
                    className="p-0.5 px-1 bg-stone-950 hover:bg-stone-800 border border-stone-800 rounded text-stone-400 hover:text-stone-200 font-mono text-[8px] cursor-pointer uppercase"
                  >
                    Сброс
                  </button>
                </div>
              </div>

              {selectedCardIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-stone-500">Выбрано карт: {selectedCardIds.length}</span>
                  {selectedCardIds.length === 1 && selectedCard?.type === 'tunnel' && (
                    <button
                      id="rotate-card-button"
                      type="button"
                      onClick={() => setIsRotated(!isRotated)}
                      className="px-2 py-1 bg-amber-900 hover:bg-amber-800 border border-amber-700/50 rounded flex items-center gap-1 text-[10px] text-amber-200 cursor-pointer"
                    >
                      Повернуть
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedCardIds([])}
                    className="p-1 hover:bg-stone-800 text-stone-400 hover:text-stone-200 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
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

          {/* Правая часть: Чат, Игроки и Логи */}
          <Sidebar
            activeTab={activeTab}
            gameState={gameState}
            myPlayerId={myPlayerId}
            chatInput={chatInput}
            setChatInput={setChatInput}
            sendAction={sendAction}
          />
        </div>

        {/* Нижняя часть: Карты игрока на руках */}
        <ActionHUD
          gameState={gameState}
          myPlayerId={myPlayerId}
          selectedCardIds={selectedCardIds}
          setSelectedCardIds={setSelectedCardIds}
          isRotated={isRotated}
          setIsRotated={setIsRotated}
          sendAction={sendAction}
        />

        {/* Наложенные экраны победы (раунд/игра) */}
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