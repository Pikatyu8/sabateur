// src/components/BoardCanvas.tsx
import React, { useRef, useEffect, useState } from 'react';
import { Flame, Eye } from 'lucide-react';
import { GameState, PlacedCard, NetworkAction } from '../types';
import { TunnelCardView } from './TunnelCardView';
import { validateTunnelPlacement } from '../gameEngine';

interface BoardCanvasProps {
  gameState: GameState;
  myPlayerId: string;
  selectedCardIds: string[];
  setSelectedCardIds: React.Dispatch<React.SetStateAction<string[]>>;
  scale: number;
  isRotated: boolean;
  sendAction: (action: NetworkAction) => void;
}

export default function BoardCanvas({
  gameState,
  myPlayerId,
  selectedCardIds,
  setSelectedCardIds,
  scale,
  isRotated,
  sendAction,
}: BoardCanvasProps) {
  const boardContainerRef = useRef<HTMLDivElement>(null);

  // Состояния для перетаскивания поля мышкой
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Автоматически скроллит поле в центр (к стартовой карте 0,0) в начале раундов
  useEffect(() => {
    const container = boardContainerRef.current;
    if (!container) return;

    const timeout = setTimeout(() => {
      const centerX = (container.scrollWidth - container.clientWidth) / 2;
      const centerY = (container.scrollHeight - container.clientHeight) / 2;
      container.scrollLeft = centerX;
      container.scrollTop = centerY;
    }, 120);

    return () => clearTimeout(timeout);
  }, [gameState.round, gameState.status]);

  // Обработчики мыши для скролла перетаскиванием
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Только левая кнопка мыши

    const container = boardContainerRef.current;
    if (!container) return;

    setIsDragging(true);
    setHasDragged(false);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const container = boardContainerRef.current;
    if (!container) return;

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    // Считаем перетаскиванием, если мышь сдвинулась более чем на 5px
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      setHasDragged(true);
    }

    container.scrollLeft = dragStart.current.scrollLeft - dx;
    container.scrollTop = dragStart.current.scrollTop - dy;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Сенсорные обработчики для мобильных устройств
  const handleTouchStart = (e: React.TouchEvent) => {
    const container = boardContainerRef.current;
    if (!container) return;

    const touch = e.touches[0];
    setIsDragging(true);
    setHasDragged(false);
    dragStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const container = boardContainerRef.current;
    if (!container) return;

    const touch = e.touches[0];
    const dx = touch.clientX - dragStart.current.x;
    const dy = touch.clientY - dragStart.current.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      setHasDragged(true);
    }

    container.scrollLeft = dragStart.current.scrollLeft - dx;
    container.scrollTop = dragStart.current.scrollTop - dy;
  };

  // Расчет границ сетки: даем запас в 4 пустые ячейки для ощущения бесконечности поля
  const getGridRange = (grid: Record<string, PlacedCard>) => {
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
      minX: minX - 4,
      maxX: maxX + 4,
      minY: minY - 4,
      maxY: maxY + 4,
    };
  };

  const renderRange = getGridRange(gameState.grid);
  const gridRows = [];
  for (let y = renderRange.minY; y <= renderRange.maxY; y++) {
    const cols = [];
    for (let x = renderRange.minX; x <= renderRange.maxX; x++) {
      cols.push({ x, y });
    }
    gridRows.push(cols);
  }

  const activePlayer = gameState.players[gameState.currentTurn];
  const isMyTurn = activePlayer?.id === myPlayerId;
  const me = gameState.players.find(p => p.id === myPlayerId);
  const selectedCard = (selectedCardIds.length === 1 && me)
    ? (me.hand.find(c => c.id === selectedCardIds[0]) || null)
    : null;

  const getTunnelPlacementResult = (x: number, y: number) => {
    if (!gameState || !selectedCard || selectedCard.type !== 'tunnel') return { valid: false };
    return validateTunnelPlacement(gameState.grid, selectedCard, x, y, isRotated);
  };

  // Стилизация курсора в зависимости от состояния зажатой мыши
  const cursorClass = isDragging ? 'cursor-grabbing select-none' : 'cursor-grab';

  return (
    <div
      id="board-canvas"
      ref={boardContainerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUpOrLeave}
      className={`flex-1 overflow-auto border border-stone-800 rounded-xl p-4 bg-stone-950 relative shadow-inner flex items-start justify-start ${cursorClass}`}
    >
      <div 
        className="flex flex-col gap-1.5 min-w-max p-2 select-none transition-transform duration-100 ease-out origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        {gridRows.map((row, yIdx) => (
          <div key={yIdx} className="flex gap-1.5 justify-center">
            {row.map(({ x, y }) => {
              const key = `${x},${y}`;
              const placed = gameState.grid[key];

              if (placed) {
                const canCaveIn = selectedCardIds.length === 1 && selectedCard?.type === 'action' && selectedCard.actionType === 'cave_in' && !placed.isEntrance && !placed.isGoal;
                const canMap = selectedCardIds.length === 1 && selectedCard?.type === 'action' && selectedCard.actionType === 'map' && placed.isGoal && !placed.flipped;

                let borderHighlight = '';
                if (canCaveIn) borderHighlight = 'ring-2 ring-red-500 animate-pulse scale-102 z-20';
                if (canMap) borderHighlight = 'ring-2 ring-sky-500 animate-pulse scale-102 z-20';

                // Точное определение наличия золота
                const goalInfo = gameState.goals.find(g => g.x === x && g.y === y);
                const isGold = !!(placed.isGold || (goalInfo && goalInfo.isGold) || (placed.card && placed.card.id === 'goal_gold'));

                return (
                  <div
                    key={key}
                    className={`relative transition-all duration-200 ${borderHighlight}`}
                    onClick={() => {
                      if (hasDragged) return; // Игнорируем клик, если это было перетаскивание поля
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
                      isGold={isGold}
                      isEntrance={placed.isEntrance}
                      flipped={placed.flipped}
                    />
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
                const canBuild = getTunnelPlacementResult(x, y).valid;

                if (canBuild && isMyTurn && selectedCard && selectedCard.type === 'tunnel') {
                  return (
                    <div key={key}>
                      <TunnelCardView
                        card={selectedCard}
                        rotated={isRotated}
                        preview={true}
                        onClick={() => {
                          if (hasDragged) return; // Игнорируем клик при перетаскивании
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

                return (
                  <div
                    key={key}
                    className="w-16 h-24 rounded-lg bg-stone-900/10 border border-stone-900/20 flex flex-col justify-between p-1 items-center hover:bg-stone-900/20 transition-colors"
                  >
                    <span className="text-[7px] text-stone-800/50 font-mono">X: {x}</span>
                    <span className="text-[7px] text-stone-800/50 font-mono">Y: {y}</span>
                  </div>
                );
              }
            })}
          </div>
        ))}
      </div>
    </div>
  );
}