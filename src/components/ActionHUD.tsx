// src/components/ActionHUD.tsx
import React from 'react';
import { GameState, NetworkAction, Card } from '../types';
import { TunnelCardView } from './TunnelCardView';
import { ActionCardView } from './ActionCardView';
import { canTransformCard } from '../goldEngine';

interface ActionHUDProps {
  gameState: GameState;
  myPlayerId: string;
  selectedCardIds: string[];
  setSelectedCardIds: React.Dispatch<React.SetStateAction<string[]>>;
  isRotated: boolean;
  setIsRotated: (val: boolean) => void;
  sendAction: (action: NetworkAction) => void;
}

export default function ActionHUD({
  gameState,
  myPlayerId,
  selectedCardIds,
  setSelectedCardIds,
  isRotated,
  setIsRotated,
  sendAction,
}: ActionHUDProps) {
  const me = gameState.players.find(p => p.id === myPlayerId);
  const activePlayer = gameState.players[gameState.currentTurn];
  const isMyTurn = activePlayer?.id === myPlayerId;

  if (!me) return null;

  const handleSelectCard = (card: Card) => {
    if (gameState.status !== 'playing' || !isMyTurn) return;

    if (selectedCardIds.includes(card.id)) {
      setSelectedCardIds(selectedCardIds.filter(id => id !== card.id));
    } else {
      // Поддерживаем выбор до 2 карт (для массовых действий)
      if (selectedCardIds.length < 2) {
        setSelectedCardIds([...selectedCardIds, card.id]);
        setIsRotated(false);
      }
    }
  };

  const handleDiscard = () => {
    if (selectedCardIds.length === 0) return;
    sendAction({ type: 'DISCARD', payload: { cardIds: selectedCardIds } });
    setSelectedCardIds([]);
  };

  const selectedCards = me.hand.filter(c => selectedCardIds.includes(c.id));
  const selectedCard = selectedCards[0] || null;

  // Проверка готовности массовых действий
  const isDoubleTunnelReady = selectedCards.length === 2 && selectedCards.every(c => c.type === 'tunnel');
  const isDoubleCaveInReady = selectedCards.length === 2 && selectedCards.some(c => c.type === 'action' && c.actionType === 'cave_in');
  const isDoubleMapReady = selectedCards.length === 2 && selectedCards.every(c => c.type === 'action' && c.actionType === 'map');

  return (
    <footer className="bg-stone-900 border-t border-stone-800 p-3 shrink-0 z-20 shadow-2xl h-auto md:h-44 flex items-center">
      <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row justify-between items-stretch gap-3 h-full">
        
        {/* Карты в руке */}
        <div className="flex-1 w-full flex flex-col justify-between min-h-[110px] md:min-h-0">
          <div className="flex justify-between items-center text-xs font-mono shrink-0">
            <span className="text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
              ⛏️ Ваши карты в руке ({me.hand.length}):
            </span>
            <div className="flex items-center gap-2">
              <span className="text-yellow-500 font-bold">🪙 Золото: {me.goldResources}</span>
              {isMyTurn && (
                <span className="text-emerald-400 font-bold animate-pulse uppercase">★ ВАШ ХОД!</span>
              )}
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto py-1 max-w-full justify-start md:justify-center items-center flex-1 my-auto">
            {me.hand.map((card) => {
              const isSel = selectedCardIds.includes(card.id);
              return (
                <div key={card.id} className="shrink-0" onClick={() => handleSelectCard(card)}>
                  {card.type === 'tunnel' ? (
                    <TunnelCardView card={card} isSelected={isSel} />
                  ) : (
                    <ActionCardView card={card} isSelected={isSel} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Панель выбранных карт и улучшений за золото */}
        <div className="w-full md:w-80 bg-stone-950 p-3 rounded-lg border border-amber-900/20 shrink-0 flex flex-col justify-between h-[200px] md:h-full overflow-y-auto">
          {selectedCardIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-4 select-none">
              <span className="text-[10px] font-mono uppercase text-stone-600 tracking-wider mb-1">Панель действий</span>
              <p className="text-[11px] text-stone-500 font-mono leading-snug">
                Выберите карту(-ы) для хода, сброса или зажмите для улучшения за золото 🪙
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 h-full justify-between">
              <div className="flex flex-col gap-1 overflow-y-auto pr-1 flex-1">
                {selectedCardIds.length === 1 ? (
                  <>
                    <span className="text-[10px] font-mono uppercase text-amber-500">Выбрано:</span>
                    <span className="text-xs font-bold text-stone-200">{selectedCard?.name}</span>
                    
                    {/* Кнопки улучшений за расходуемое золото */}
                    <div className="mt-1 flex flex-col gap-1 border-t border-stone-800 pt-1">
                      <p className="text-[8px] font-mono text-stone-500 uppercase">Улучшить карту (🪙):</p>
                      
                      {/* Опции за 1 золото */}
                      {selectedCard?.type === 'tunnel' && !selectedCard.hasCrystal && (
                        <button
                          disabled={me.goldResources < 1}
                          onClick={() => {
                            sendAction({ type: 'TRANSFORM_CARD', payload: { cardId: selectedCard.id, targetType: 'crystal_tunnel', cost: 1 } });
                            setSelectedCardIds([]);
                          }}
                          className="text-[9px] bg-cyan-950 border border-cyan-800 text-cyan-200 p-1 rounded hover:bg-cyan-900 font-mono cursor-pointer"
                        >
                          Внедрить Кристалл (🪙 1)
                        </button>
                      )}

                      {selectedCard?.type === 'action' && selectedCard.actionType === 'repair_tool' && (
                        <button
                          disabled={me.goldResources < 1}
                          onClick={() => {
                            sendAction({ type: 'TRANSFORM_CARD', payload: { cardId: selectedCard.id, targetType: 'repair_to_break', cost: 1 } });
                            setSelectedCardIds([]);
                          }}
                          className="text-[9px] bg-red-950 border border-red-800 text-red-200 p-1 rounded hover:bg-red-900 font-mono cursor-pointer"
                        >
                          Изменить в Поломку (🪙 1)
                        </button>
                      )}

                      {selectedCard?.type === 'action' && selectedCard.actionType === 'break_tool' && (
                        <button
                          disabled={me.goldResources < 1}
                          onClick={() => {
                            sendAction({ type: 'TRANSFORM_CARD', payload: { cardId: selectedCard.id, targetType: 'break_to_repair', cost: 1 } });
                            setSelectedCardIds([]);
                          }}
                          className="text-[9px] bg-emerald-950 border border-emerald-800 text-emerald-200 p-1 rounded hover:bg-emerald-900 font-mono cursor-pointer"
                        >
                          Изменить в Ремонт (🪙 1)
                        </button>
                      )}

                      {selectedCard?.type === 'action' && selectedCard.actionType === 'map' && (
                        <div className="flex gap-1 flex-col">
                          <button
                            disabled={me.goldResources < 1}
                            onClick={() => {
                              sendAction({ type: 'TRANSFORM_CARD', payload: { cardId: selectedCard.id, targetType: 'map_to_view_role', cost: 1 } });
                              setSelectedCardIds([]);
                            }}
                            className="text-[9px] bg-indigo-950 border border-indigo-800 text-indigo-200 p-1 rounded hover:bg-indigo-900 font-mono cursor-pointer"
                          >
                            Преобразовать в Оценку Роли (🪙 1)
                          </button>
                          <button
                            disabled={me.goldResources < 2}
                            onClick={() => {
                              sendAction({ type: 'TRANSFORM_CARD', payload: { cardId: selectedCard.id, targetType: 'map_to_swap_roles', cost: 2 } });
                              setSelectedCardIds([]);
                            }}
                            className="text-[9px] bg-pink-950 border border-pink-800 text-pink-200 p-1 rounded hover:bg-pink-900 font-mono cursor-pointer"
                          >
                            Преобразовать в Смену Роли (🪙 2)
                          </button>
                        </div>
                      )}

                      {selectedCard?.type === 'tunnel' && (
                        <button
                          disabled={me.goldResources < 2}
                          onClick={() => {
                            sendAction({ type: 'TRANSFORM_CARD', payload: { cardId: selectedCard.id, targetType: 'tunnel_to_cave_in', cost: 2 } });
                            setSelectedCardIds([]);
                          }}
                          className="text-[9px] bg-amber-950 border border-amber-800 text-amber-200 p-1 rounded hover:bg-amber-900 font-mono cursor-pointer"
                        >
                          Преобразовать в Обвал (🪙 2)
                        </button>
                      )}
                    </div>

                    {/* Выбор цели для дуэлей, обменов рук, ролей */}
                    {selectedCard?.type === 'action' && selectedCard.actionType === 'view_role' && (
                      <div className="mt-2 flex flex-col gap-1">
                        <span className="text-[8px] text-stone-500 uppercase font-mono">Выбрать игрока:</span>
                        {gameState.players.filter(p => p.id !== myPlayerId && p.active).map(p => (
                          <button
                            key={p.id}
                            onClick={() => {
                              sendAction({ type: 'PLAY_ACTION', payload: { cardId: selectedCard.id, targetPlayerId: p.id } });
                              setSelectedCardIds([]);
                            }}
                            className="text-[9px] bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 p-1 rounded text-stone-200 font-mono"
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedCard?.type === 'action' && selectedCard.actionType === 'swap_roles' && (
                      <div className="mt-2 flex flex-col gap-1">
                        <span className="text-[8px] text-stone-500 uppercase font-mono">Выбрать гнома для смены роли:</span>
                        <button
                          onClick={() => {
                            sendAction({ type: 'PLAY_ACTION', payload: { cardId: selectedCard.id, targetPlayerId: myPlayerId } });
                            setSelectedCardIds([]);
                          }}
                          className="text-[9px] bg-pink-950 hover:bg-pink-900 border border-pink-800 p-1 rounded text-stone-200 font-mono"
                        >
                          Сменить себе (Вы)
                        </button>
                        {gameState.players.filter(p => p.id !== myPlayerId && p.active).map(p => (
                          <button
                            key={p.id}
                            onClick={() => {
                              sendAction({ type: 'PLAY_ACTION', payload: { cardId: selectedCard.id, targetPlayerId: p.id } });
                              setSelectedCardIds([]);
                            }}
                            className="text-[9px] bg-pink-950 hover:bg-pink-900 border border-pink-800 p-1 rounded text-stone-200 font-mono"
                          >
                            Сменить {p.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedCard?.type === 'action' && selectedCard.actionType === 'swap_cards' && (
                      <div className="mt-2 flex flex-col gap-1">
                        <span className="text-[8px] text-stone-500 uppercase font-mono">С кем обменяться картами:</span>
                        {gameState.players.filter(p => p.id !== myPlayerId && p.active).map(p => (
                          <button
                            key={p.id}
                            onClick={() => {
                              sendAction({ type: 'PLAY_ACTION', payload: { cardId: selectedCard.id, targetPlayerId: p.id } });
                              setSelectedCardIds([]);
                            }}
                            className="text-[9px] bg-teal-950 hover:bg-teal-900 border border-teal-800 p-1 rounded text-stone-200 font-mono"
                          >
                            Обменяться с {p.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedCard?.type === 'action' && selectedCard.actionType === 'tic_tac_toe' && (
                      <div className="mt-2 flex flex-col gap-1">
                        <span className="text-[8px] text-stone-500 uppercase font-mono">Вызвать соперника на дуэль TTT:</span>
                        {gameState.players.filter(p => p.id !== myPlayerId && p.active).map(p => (
                          <button
                            key={p.id}
                            onClick={() => {
                              sendAction({ type: 'PLAY_ACTION', payload: { cardId: selectedCard.id, targetPlayerId: p.id } });
                              setSelectedCardIds([]);
                            }}
                            className="text-[9px] bg-yellow-950 hover:bg-yellow-900 border border-yellow-800 p-1 rounded text-stone-200 font-mono"
                          >
                            Вызвать {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-mono text-amber-500">Выбрано {selectedCardIds.length} карт</span>
                    
                    {/* Запуск массовых действий при выборе двух карт */}
                    {isDoubleTunnelReady && (
                      <button
                        onClick={() => {
                          sendAction({ type: 'ACTIVATE_MASS_ACTION', payload: { type: 'double_tunnel' } });
                          setSelectedCardIds([]);
                        }}
                        className="w-full text-xs font-mono font-bold uppercase bg-gradient-to-r from-amber-800 to-amber-950 border border-amber-600 text-stone-100 py-1.5 rounded"
                      >
                        Двойной путь (Лимит руки -1)
                      </button>
                    )}

                    {isDoubleCaveInReady && (
                      <button
                        onClick={() => {
                          sendAction({ type: 'ACTIVATE_MASS_ACTION', payload: { type: 'double_cave_in', cardId1: selectedCardIds[0], cardId2: selectedCardIds[1] } });
                          setSelectedCardIds([]);
                        }}
                        className="w-full text-xs font-mono font-bold uppercase bg-gradient-to-r from-red-950 to-stone-950 border border-red-700 text-stone-100 py-1.5 rounded"
                      >
                        Двойной Обвал (Лимит руки -1)
                      </button>
                    )}

                    {isDoubleMapReady && (
                      <button
                        onClick={() => {
                          sendAction({ type: 'ACTIVATE_MASS_ACTION', payload: { type: 'double_map', cardId1: selectedCardIds[0], cardId2: selectedCardIds[1] } });
                          setSelectedCardIds([]);
                        }}
                        className="w-full text-xs font-mono font-bold uppercase bg-gradient-to-r from-sky-950 to-stone-950 border border-sky-700 text-stone-100 py-1.5 rounded"
                      >
                        Двойной Просмотр (Без штрафа)
                      </button>
                    )}
                  </>
                )}
              </div>

              {gameState.massActionState?.active && (
                <button
                  onClick={() => sendAction({ type: 'CONFIRM_MASS_ACTION' })}
                  className="w-full py-1.5 bg-emerald-900 border border-emerald-600 text-stone-100 font-mono text-xs rounded"
                >
                  Завершить Массовый Ход
                </button>
              )}

              <button
                disabled={!isMyTurn}
                onClick={handleDiscard}
                className="w-full mt-2 py-1.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 font-mono text-xs rounded"
              >
                СБРОСИТЬ КАРТЫ
              </button>
            </div>
          )}
        </div>

      </div>
    </footer>
  );
}