import React from 'react';
import { GameState, NetworkAction, Card } from '../types';
import { TunnelCardView } from './TunnelCardView';
import { ActionCardView } from './ActionCardView';

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
    if (gameState.status !== 'playing') return;
    if (!isMyTurn) return;

    if (selectedCardIds.includes(card.id)) {
      setSelectedCardIds(selectedCardIds.filter(id => id !== card.id));
    } else {
      if (selectedCardIds.length < 3) {
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

  return (
    <footer className="bg-stone-900 border-t border-stone-800 p-3 shrink-0 z-20 shadow-2xl shadow-black h-auto md:h-44 flex items-center">
      <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row justify-between items-stretch gap-3 h-full">
        
        {/* Карты в руке (Левая статичная панель) */}
        <div className="flex-1 w-full flex flex-col justify-between min-h-[110px] md:min-h-0">
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
            {me.hand.length === 0 && (
              <div className="text-stone-500 font-mono text-xs py-4 text-center w-full uppercase">
                У вас нет карт в руке
              </div>
            )}
          </div>
        </div>

        {/* Панель выбранных карт и действий (Правая панель - всегда зафиксирована) */}
        <div className="w-full md:w-80 bg-stone-950 p-3 rounded-lg border border-amber-900/20 shrink-0 flex flex-col justify-between h-[180px] md:h-full overflow-y-auto">
          {selectedCardIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-4 select-none">
              <span className="text-[10px] font-mono uppercase text-stone-600 tracking-wider mb-1">Панель действий</span>
              <p className="text-[11px] text-stone-500 font-mono leading-snug">
                Выберите карту из руки, чтобы выполнить действие, проложить путь или сбросить её
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 h-full justify-between">
              <div className="flex flex-col gap-1 overflow-y-auto pr-1 flex-1">
                {selectedCardIds.length === 1 ? (
                  <>
                    <span className="text-[10px] font-mono uppercase text-amber-500 tracking-wider">Выбранная карта:</span>
                    <span className="text-sm font-bold text-stone-200">{selectedCard?.name}</span>
                    <p className="text-[11px] text-stone-400 font-mono leading-snug">
                      {selectedCard && 'description' in selectedCard ? selectedCard.description : 'Постройте этот фрагмент туннеля на игровом поле так, чтобы продолжить путь к золотой жиле.'}
                    </p>

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
                      {selectedCardIds.length === 2 && me.brokenTools.length > 0 && (
                        <div className="flex flex-col gap-1.5 mt-1 border-t border-stone-800 pt-2">
                          <span className="text-[9px] font-mono text-stone-500 uppercase">ПОЧИНКА СЕБЯ ЗА 2 КАРТЫ:</span>
                          {me.brokenTools.map(tool => {
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

              {/* Кнопка сброса всегда внизу панели */}
              <button
                disabled={!isMyTurn}
                onClick={handleDiscard}
                className="w-full mt-2 py-1.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 font-mono text-xs rounded flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 shrink-0"
              >
                СБРОСИТЬ КАРТУ (Пропуск хода)
              </button>
            </div>
          )}
        </div>

      </div>
    </footer>
  );
}