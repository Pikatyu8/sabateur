// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Pickaxe,
  ShieldAlert,
  ShieldCheck,
  HelpCircle,
  Coins,
  Flame,
  Eye,
  RefreshCw,
  Play,
  Send,
  User,
  Copy,
  Plus,
  X,
  MessageSquare,
  List,
  Users,
  Grid,
  Trophy,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { usePeerGame } from './peerManager';
import { TunnelCardView } from './components/TunnelCardView';
import { ActionCardView } from './components/ActionCardView';
import { Card, PlacedCard, Player, ToolType } from './types';
import { validateTunnelPlacement } from './gameEngine';

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

  // Local state
  const [playerName, setPlayerName] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [scale, setScale] = useState<number>(0.85); // Изменено с 0.6 до 0.85 для компактного отображения
  const [isRotated, setIsRotated] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'board' | 'players' | 'chat' | 'logs'>('board');
  const [copied, setCopied] = useState<boolean>(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);

  // Нативный некостыльный перехват события колесика мыши (onWheel с опцией passive: false)
  // Это предотвращает физическую прокрутку страницы во время изменения масштаба поля
  useEffect(() => {
    const container = boardContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); // Нативно блокируем стандартный скролл
      const zoomFactor = e.deltaY < 0 ? 0.05 : -0.05;
      setScale(prev => Math.min(1.5, Math.max(0.15, prev + zoomFactor)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [gameState?.status, connectionStatus]); // Перезапускаем при изменении экранов игры

  // Auto scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState?.logs, activeTab]);

  // Handle card selection
  const handleSelectCard = (card: Card) => {
    if (gameState?.status !== 'playing') return;
    const isMyTurn = gameState.players[gameState.currentTurn].id === myPlayerId;
    if (!isMyTurn) return;

    if (selectedCardIds.includes(card.id)) {
      setSelectedCardIds(selectedCardIds.filter(id => id !== card.id));
    } else {
      if (selectedCardIds.length < 3) {
        setSelectedCardIds([...selectedCardIds, card.id]);
        setIsRotated(false); // Reset rotation
      }
    }
  };

  // Get selected cards helper
  const getSelectedCards = (): Card[] => {
    if (selectedCardIds.length === 0 || !gameState) return [];
    const me = gameState.players.find(p => p.id === myPlayerId);
    if (!me) return [];
    return me.hand.filter(c => selectedCardIds.includes(c.id));
  };

  const selectedCards = getSelectedCards();
  const selectedCard = selectedCards[0] || null;

  // Copy Room Code helper
  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Chat sender
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendAction({ type: 'SEND_CHAT', payload: { message: chatInput.trim() } });
    setChatInput('');
  };

  // Discard handler
  const handleDiscard = () => {
    if (selectedCardIds.length === 0) return;
    sendAction({ type: 'DISCARD', payload: { cardIds: selectedCardIds } });
    setSelectedCardIds([]);
  };

  // Board coordinate bound computation
  const getGridRange = (grid: Record<string, PlacedCard>) => {
    // Начинаем с фактических границ входа (0,0) и целевых карт (8, -2/0/2)
    let minX = 0;
    let maxX = 8;
    let minY = -2;
    let maxY = 2;

    Object.keys(grid).forEach(key => {
      const [xStr, yStr] = key.split(',');
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    return {
      minX: minX - 1,
      maxX: maxX + 1,
      minY: minY - 1,
      maxY: maxY + 1,
    };
  };

  // Render grid coordinates array
  const renderRange = gameState ? getGridRange(gameState.grid) : { minX: -1, maxX: 9, minY: -3, maxY: 3 };

  const gridRows = [];
  for (let y = renderRange.minY; y <= renderRange.maxY; y++) {
    const cols = [];
    for (let x = renderRange.minX; x <= renderRange.maxX; x++) {
      cols.push({ x, y });
    }
    gridRows.push(cols);
  }

  // Get current active player object
  const getActivePlayer = (): Player | null => {
    if (!gameState) return null;
    return gameState.players[gameState.currentTurn] || null;
  };

  const activePlayer = getActivePlayer();
  const isMyTurn = activePlayer?.id === myPlayerId;
  const localPlayer = gameState?.players.find(p => p.id === myPlayerId);

  // Check if a coordinates has valid tunnel placement preview
  const getTunnelPlacementResult = (x: number, y: number) => {
    if (!gameState || !selectedCard || selectedCard.type !== 'tunnel' || selectedCardIds.length > 1) return { valid: false };
    return validateTunnelPlacement(gameState.grid, selectedCard, x, y, isRotated);
  };

  // Connection Screen
  if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
    return (
      <div id="connection-screen" className="min-h-screen bg-stone-950 text-stone-100 font-sans flex flex-col justify-between p-4 selection:bg-amber-800 selection:text-white">
        {/* Header decoration */}
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

        {/* Form panel */}
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
                  maxLength={16}
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

        {/* Footer */}
        <footer className="text-center py-6 text-[10px] text-stone-600 font-mono uppercase tracking-wider max-w-md mx-auto w-full">
          Удачи на путях к золоту! ⛏️💎
        </footer>
      </div>
    );
  }

  // Connecting transition state
  if (connectionStatus === 'connecting') {
    return (
      <div id="connecting-state" className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-stone-400 font-mono gap-4">
        <RefreshCw className="w-10 h-10 text-amber-500 animate-spin" />
        <span className="text-xs uppercase tracking-widest animate-pulse">Установка WebRTC соединения...</span>
      </div>
    );
  }

  // LOBBY STATE (WAITING FOR PLAYERS)
  if (gameState && gameState.status === 'lobby') {
    return (
      <div id="lobby-screen" className="min-h-screen bg-stone-950 text-stone-100 font-sans flex flex-col justify-between p-4">
        <header className="max-w-md mx-auto w-full py-4 text-center">
          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/30">
            Игровое лобби
          </span>
          <h2 className="text-2xl font-bold font-mono text-stone-300 mt-2">Ожидание игроков</h2>
        </header>

        <main className="max-w-md mx-auto w-full bg-stone-900 border border-stone-800 rounded-xl p-6 shadow-2xl shadow-black my-auto flex flex-col gap-6">
          {/* Room code display */}
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

          {/* Connected players list */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-mono uppercase text-stone-400 tracking-wider">Присоединились ({gameState.players.length}/10):</span>
              <Users className="w-4 h-4 text-stone-500" />
            </div>

            <div className="bg-stone-950 border border-stone-800 rounded-lg divide-y divide-stone-800 max-h-48 overflow-y-auto">
              {gameState.players.map((p, idx) => (
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

          {/* Action buttons */}
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

  // MAIN ACTIVE GAME STATE
  if (gameState) {
    const me = gameState.players.find(p => p.id === myPlayerId)!;
    const isRoundEnd = gameState.status === 'round_end';
    const isGameEnd = gameState.status === 'game_end';

    return (
      <div id="game-arena" className="min-h-screen bg-stone-950 text-stone-100 font-sans flex flex-col selection:bg-amber-800">
        {/* Game Header */}
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

          {/* Secret Role banner on top bar for rapid reference */}
          {me && me.role && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border bg-stone-950 text-xs font-medium max-w-[180px] sm:max-w-none">
              <span className="text-stone-500 font-mono text-[10px] uppercase">РОЛЬ:</span>
              {me.role === 'miner' ? (
                <span className="text-emerald-400 flex items-center gap-1 font-mono">
                  ⛏️ Шахтер
                </span>
              ) : (
                <span className="text-red-400 flex items-center gap-1 font-mono">
                  👺 Вредитель
                </span>
              )}
            </div>
          )}

          {/* Mobile responsive tabs bar */}
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

        {/* Main Panel Layout */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* LEFT: Game Board Grid */}
          <main className={`flex-1 flex flex-col p-3 overflow-hidden ${activeTab === 'board' ? 'block' : 'hidden sm:flex'}`}>
            {/* Quick status line */}
            <div className="mb-2 flex flex-wrap gap-2 justify-between items-center text-xs font-mono shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-500">Ход:</span>
                  {gameState.status === 'playing' ? (
                    <span className={`px-2 py-0.5 rounded font-bold ${isMyTurn ? 'bg-amber-500 text-stone-950 animate-pulse' : 'bg-stone-900 text-amber-500 border border-stone-800'}`}>
                      {activePlayer?.name} {isMyTurn && '(Вы)'}
                    </span>
                  ) : (
                    <span className="text-stone-400 uppercase tracking-widest font-bold">Раунд завершен</span>
                  )}
                </div>

                {/* ZOOM CONTROLS */}
                <div className="flex items-center gap-1 bg-stone-900/60 border border-stone-800 rounded-md p-1">
                  <button
                    type="button"
                    onClick={() => setScale(prev => Math.max(0.15, prev - 0.05))}
                    className="p-0.5 px-1.5 bg-stone-950 hover:bg-stone-800 border border-stone-800 rounded text-stone-300 font-mono text-[10px] cursor-pointer"
                    title="Отдалить (или Колесиком мыши)"
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
                    title="Приблизить (или Колесиком мыши)"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setScale(0.85)}
                    className="p-0.5 px-1 bg-stone-950 hover:bg-stone-800 border border-stone-800 rounded text-stone-400 hover:text-stone-200 font-mono text-[8px] cursor-pointer uppercase"
                    title="Сбросить масштаб"
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
                      <RefreshCw className="w-3 h-3 animate-spin" />
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

            {/* Scrollable Panning Board Canvas (Обработчик 'onWheel' удален отсюда в 'useEffect' с passive: false) */}
            <div
              id="board-canvas"
              ref={boardContainerRef}
              className="flex-1 overflow-auto border border-stone-800 rounded-xl p-4 bg-stone-950 relative shadow-inner flex items-start justify-start"
            >
              {/* Actual Map Grid — Изменено p-20 на p-6 для экономии места */}
              <div 
                className="flex flex-col gap-2 min-w-max p-6 select-none transition-transform duration-100 ease-out origin-top-left"
                style={{ transform: `scale(${scale})` }}
              >
                {gridRows.map((row, yIdx) => (
                  <div key={yIdx} className="flex gap-2 justify-center">
                    {row.map(({ x, y }) => {
                      const key = `${x},${y}`;
                      const placed = gameState.grid[key];

                      if (placed) {
                        // Is there an active target effect on this card?
                        const canCaveIn = selectedCardIds.length === 1 && selectedCard?.type === 'action' && selectedCard.actionType === 'cave_in' && !placed.isEntrance && !placed.isGoal;
                        const canMap = selectedCardIds.length === 1 && selectedCard?.type === 'action' && selectedCard.actionType === 'map' && placed.isGoal && !placed.flipped;

                        let borderHighlight = '';
                        if (canCaveIn) borderHighlight = 'ring-2 ring-red-500 animate-pulse scale-102 z-20';
                        if (canMap) borderHighlight = 'ring-2 ring-sky-500 animate-pulse scale-102 z-20';

                        return (
                          <div
                            key={key}
                            className={`relative transition-all duration-200 ${borderHighlight}`}
                            onClick={() => {
                              if (canCaveIn) {
                                sendAction({
                                  type: 'PLAY_ACTION',
                                  payload: { cardId: selectedCardIds[0], targetPlayerId: undefined, x, y }
                                });
                                setSelectedCardIds([]);
                              } else if (canMap) {
                                sendAction({
                                  type: 'PLAY_ACTION',
                                  payload: { cardId: selectedCardIds[0], targetPlayerId: undefined, x, y }
                                });
                                setSelectedCardIds([]);
                              }
                            }}
                          >
                            <TunnelCardView
                              card={placed.card}
                              rotated={placed.rotated}
                              isGoal={placed.isGoal}
                              isGold={placed.isGold}
                              isEntrance={placed.isEntrance}
                              flipped={placed.flipped}
                            />
                            {/* Visual indicator that target can be detonated or inspected */}
                            {canCaveIn && (
                              <div className="absolute inset-0 bg-red-900/30 flex items-center justify-center rounded-lg">
                                <Flame className="w-6 h-6 text-red-500" />
                              </div>
                            )}
                            {canMap && (
                              <div className="absolute inset-0 bg-sky-900/30 flex items-center justify-center rounded-lg">
                                <Eye className="w-6 h-6 text-sky-400 animate-pulse" />
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        // If cell is empty, check if we can place current card there
                        const canBuild = getTunnelPlacementResult(x, y).valid;

                        if (canBuild && isMyTurn && selectedCard && selectedCard.type === 'tunnel' && selectedCardIds.length === 1) {
                          return (
                            <div key={key}>
                              <TunnelCardView
                                card={selectedCard}
                                rotated={isRotated}
                                preview={true}
                                onClick={() => {
                                  sendAction({
                                    type: 'PLAY_TUNNEL',
                                    payload: { cardId: selectedCardIds[0], x, y, rotated: isRotated }
                                  });
                                  setSelectedCardIds([]);
                                }}
                              />
                            </div>
                          );
                        }

                        // Otherwise just standard empty coordinate
                        return (
                          <div
                            key={key}
                            className="w-16 h-24 rounded-lg bg-stone-900/10 border border-stone-900/30 flex flex-col justify-between p-1 items-center hover:bg-stone-900/20 transition-colors"
                          >
                            <span className="text-[7px] text-stone-700/60 font-mono">X: {x}</span>
                            <span className="text-[7px] text-stone-700/60 font-mono">Y: {y}</span>
                          </div>
                        );
                      }
                    })}
                  </div>
                ))}
              </div>
            </div>
          </main>

          {/* RIGHT: Sidebar Panels (Switchable on mobile, persistent on desktop) */}
          <aside className={`w-full sm:w-80 border-l border-stone-800 bg-stone-900/40 flex flex-col shrink-0 overflow-hidden ${activeTab === 'board' ? 'hidden sm:flex' : 'flex'}`}>
            
            {/* Tab view for mobile sidebar blocks */}
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* PLAYERS LIST (tab: players) */}
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
                            {p.active ? (
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full bg-stone-700 shrink-0" />
                            )}
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
                          {/* Hand size */}
                          <span className="text-[10px] text-stone-500 font-mono">Карт в руке: {p.handSize}</span>

                          {/* Broken tools list */}
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

                        {/* True roles reveal at round end */}
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

              {/* CHAT PANEL (tab: chat) */}
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
                    className="p-1.5 bg-amber-800 hover:bg-amber-700 border border-amber-700 rounded-lg text-amber-200 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

              {/* GAME SYSTEM LOGS (tab: logs) */}
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
        </div>

        {/* BOTTOM: Action HUD & Cards Hand */}
        <footer className="bg-stone-900 border-t border-stone-800 p-3 shrink-0 z-20 shadow-2xl shadow-black">
          <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row justify-between items-center gap-3">
            
            {/* Player Hand & Controls */}
            <div className="flex-1 w-full flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs font-mono shrink-0">
                <span className="text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                  ⛏️ Ваши карты в руке ({me.hand.length}):
                </span>
                {isMyTurn && (
                  <span className="text-emerald-400 font-bold animate-pulse uppercase tracking-wider">
                    ★ ВАШ ХОД!
                  </span>
                )}
              </div>

              {/* Cards row */}
              <div className="flex gap-2 overflow-x-auto py-1 max-w-full justify-start md:justify-center">
                {me.hand.map((card) => {
                  const isSel = selectedCardIds.includes(card.id);
                  return (
                    <div key={card.id} onClick={() => handleSelectCard(card)}>
                      {card.type === 'tunnel' ? (
                        <TunnelCardView card={card} isSelected={isSel} />
                      ) : (
                        <ActionCardView card={card} isSelected={isSel} />
                      )}
                    </div>
                  );
                })}
                {me.hand.length === 0 && (
                  <div className="text-stone-500 font-mono text-xs py-4 text-center w-full uppercase">
                    У вас нет карт в руке
                  </div>
                )}
              </div>
            </div>

            {/* Selection HUD Panel */}
            {selectedCardIds.length > 0 && (
              <div className="w-full md:w-80 bg-stone-950 p-3 rounded-lg border border-amber-900/30 shrink-0 flex flex-col gap-2">
                {selectedCardIds.length === 1 ? (
                  <>
                    <span className="text-[10px] font-mono uppercase text-amber-500 tracking-wider">Выбранная карта:</span>
                    <span className="text-sm font-bold text-stone-200">{selectedCard?.name}</span>
                    <p className="text-[11px] text-stone-400 font-mono leading-snug">
                      {selectedCard && 'description' in selectedCard ? selectedCard.description : 'Постройте этот фрагмент туннеля на игровом поле так, чтобы продолжить путь к золотой жиле.'}
                    </p>

                    {/* Specific actions based on card type */}
                    <div className="mt-1 flex flex-col gap-1.5">
                      {selectedCard && selectedCard.type === 'action' && selectedCard.actionType === 'break_tool' && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-mono text-stone-500 uppercase">Выберите игрока сломать {selectedCard.toolType === 'lamp' ? 'Фонарь' : selectedCard.toolType === 'cart' ? 'Вагонетку' : 'Кирку'}:</span>
                          <div className="flex flex-wrap gap-1">
                            {gameState.players
                              .filter(p => p.id !== myPlayerId && p.active && !p.brokenTools.includes(selectedCard.toolType!))
                              .map(p => (
                                <button
                                  key={p.id}
                                  disabled={!isMyTurn}
                                  onClick={() => {
                                    sendAction({
                                      type: 'PLAY_ACTION',
                                      payload: { cardId: selectedCardIds[0], targetPlayerId: p.id }
                                    });
                                    setSelectedCardIds([]);
                                  }}
                                  className="px-2 py-1 bg-red-950/40 hover:bg-red-900/50 border border-red-800 text-red-200 text-[10px] font-mono rounded cursor-pointer transition-all disabled:opacity-40"
                                >
                                  {p.name}
                                </button>
                              ))}
                            {gameState.players.filter(p => p.id !== myPlayerId && p.active && !p.brokenTools.includes(selectedCard.toolType!)).length === 0 && (
                              <span className="text-[9px] text-stone-600 font-mono">Нет подходящих игроков</span>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedCard && selectedCard.type === 'action' && selectedCard.actionType === 'repair_tool' && !selectedCard.repairTypes && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-mono text-stone-500 uppercase">Выберите игрока починить {selectedCard.toolType === 'lamp' ? 'Фонарь' : selectedCard.toolType === 'cart' ? 'Вагонетку' : 'Кирку'}:</span>
                          <div className="flex flex-wrap gap-1">
                            {gameState.players
                              .filter(p => p.active && p.brokenTools.includes(selectedCard.toolType!))
                              .map(p => (
                                <button
                                  key={p.id}
                                  disabled={!isMyTurn}
                                  onClick={() => {
                                    sendAction({
                                      type: 'PLAY_ACTION',
                                      payload: { cardId: selectedCardIds[0], targetPlayerId: p.id }
                                    });
                                    setSelectedCardIds([]);
                                  }}
                                  className="px-2 py-1 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800 text-emerald-200 text-[10px] font-mono rounded cursor-pointer transition-all disabled:opacity-40"
                                >
                                  {p.name} {p.id === myPlayerId && '(Вы)'}
                                </button>
                              ))}
                            {gameState.players.filter(p => p.active && p.brokenTools.includes(selectedCard.toolType!)).length === 0 && (
                              <span className="text-[9px] text-stone-600 font-mono">Ни у кого не сломан этот инструмент</span>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedCard && selectedCard.type === 'action' && selectedCard.actionType === 'repair_tool' && selectedCard.repairTypes && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-mono text-stone-500 uppercase">Выберите инструмент и игрока для починки:</span>
                          {selectedCard.repairTypes.map(tool => {
                            const targets = gameState.players.filter(p => p.active && p.brokenTools.includes(tool));
                            return (
                              <div key={tool} className="flex flex-col gap-0.5">
                                <span className="text-[8px] font-mono text-stone-500 uppercase">{tool === 'lamp' ? 'Фонарь' : tool === 'cart' ? 'Вагонетка' : 'Кирка'}:</span>
                                <div className="flex flex-wrap gap-1">
                                  {targets.map(p => (
                                    <button
                                      key={p.id}
                                      disabled={!isMyTurn}
                                      onClick={() => {
                                        sendAction({
                                          type: 'PLAY_ACTION',
                                          payload: { cardId: selectedCardIds[0], targetPlayerId: p.id, toolToRepair: tool }
                                        });
                                        setSelectedCardIds([]);
                                      }}
                                      className="px-2 py-0.5 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800 text-emerald-200 text-[10px] font-mono rounded cursor-pointer transition-all disabled:opacity-40"
                                    >
                                      {p.name} {p.id === myPlayerId && '(Вы)'}
                                    </button>
                                  ))}
                                  {targets.length === 0 && (
                                    <span className="text-[8px] text-stone-600 font-mono">Ни у кого не сломан</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {selectedCard && selectedCard.type === 'action' && selectedCard.actionType === 'cave_in' && (
                        <span className="text-[10px] text-amber-500 font-mono animate-pulse uppercase">
                          ※ Кликните на ячейку на поле для подрыва!
                        </span>
                      )}

                      {selectedCard && selectedCard.type === 'action' && selectedCard.actionType === 'map' && (
                        <span className="text-[10px] text-sky-400 font-mono animate-pulse uppercase">
                          ※ Кликните на любую закрытую карту цели на поле!
                        </span>
                      )}

                      <button
                        disabled={!isMyTurn}
                        onClick={handleDiscard}
                        className="w-full mt-2 py-1.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 font-mono text-xs rounded flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                      >
                        СБРОСИТЬ КАРТУ (Пропуск хода)
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-mono uppercase text-amber-500 tracking-wider">Выбрано карт ({selectedCardIds.length}):</span>
                    <div className="flex flex-col gap-1 max-h-24 overflow-y-auto bg-stone-900/50 p-1.5 rounded border border-stone-800">
                      {selectedCards.map(c => (
                        <span key={c.id} className="text-xs font-mono text-stone-300 truncate">🃟 {c.name}</span>
                      ))}
                    </div>

                    <div className="mt-2 flex flex-col gap-2">
                      <button
                        disabled={!isMyTurn}
                        onClick={handleDiscard}
                        className="w-full py-2 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-amber-500 font-mono text-xs rounded flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 font-bold"
                      >
                        СБРОСИТЬ ВЫБРАННЫЕ КАРТЫ ({selectedCardIds.length})
                      </button>

                      {selectedCardIds.length === 2 && localPlayer && localPlayer.brokenTools.length > 0 && (
                        <div className="flex flex-col gap-1.5 mt-1 border-t border-stone-800 pt-2">
                          <span className="text-[9px] font-mono text-stone-500 uppercase">ПОЧИНКА СЕБЯ ЗА 2 КАРТЫ:</span>
                          {localPlayer.brokenTools.map(tool => {
                            const toolNameRu = tool === 'lamp' ? 'Фонарь' : tool === 'cart' ? 'Вагонетка' : 'Кирка';
                            return (
                              <button
                                key={tool}
                                disabled={!isMyTurn}
                                onClick={() => {
                                  sendAction({
                                    type: 'REPAIR_SELF_WITH_DISCARD',
                                    payload: { cardIds: selectedCardIds, toolToRepair: tool }
                                  });
                                  setSelectedCardIds([]);
                                }}
                                className="w-full py-1.5 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800 text-emerald-200 text-xs font-mono rounded flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 font-medium"
                              >
                                Починить себе {toolNameRu} (минус 1 карта)
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </footer>

        {/* Victory Overlays */}
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

        {/* Final Game End Overlay */}
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

                {/* Scores leaderboard */}
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
      </div>
    );
  }

  return null;
}