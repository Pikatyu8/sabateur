// src/components/BoardCanvas.tsx
import React, { useRef, useEffect } from 'react';
import { Flame, Eye } from 'lucide-react';
import { GameState, PlacedCard, Card, NetworkAction } from '../types';
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

  // Автоматически скроллит поле в центр (к стартовой карте 0,0) в начале раундов
  useEffect(() => {
    const container = boardContainerRef.current;
    if (!container) return;

    const timeout = setTimeout(() => {
      const centerX = (container.scrollWidth - container.clientWidth) / 2;
      const centerY = (container.scrollHeight - container.clientHeight) / 2;
      container.scrollLeft = centerX;
      container.scrollTop = centerY;
    }, 100);

    return () => clearTimeout(timeout);
  }, [gameState.round, gameState.status]);

  const getGridRange = (grid: Record<string, PlacedCard>) => {
    // Начальные компактные границы для лучшей видимости
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

  return (
    <div
      id="board-canvas"
      ref={boardContainerRef}
      className="flex-1 overflow-auto border border-stone-800 rounded-xl p-4 bg-stone-950 relative shadow-inner flex items-start justify-start"
    >
      {/* Плотная сетка с отступом p-6 вместо p-20 */}
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
  );
}