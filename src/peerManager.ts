// src/peerManager.ts
import { useState, useEffect, useRef } from 'react';
import { GameState, Player, Card, TunnelCard, ActionCard, PlacedCard, ToolType, LogEntry, NetworkAction } from './types';
import {
  createFullDeck,
  getEntranceCard,
  getGoalTemplates,
  validateTunnelPlacement,
  calculateReachability,
} from './gameEngine';
import { transformCard } from './goldEngine';
import { checkTTTWinner, isTTTBoardFull } from './ticTacToeEngine';

const getSessionClientId = () => {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem('saboteur_peer_id');
  if (!id) {
    id = `sab-player-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
    sessionStorage.setItem('saboteur_peer_id', id);
  }
  return id;
};

export const filterStateForPlayer = (state: GameState, playerId: string): GameState => {
  const isRoundOver = state.status === 'round_end' || state.status === 'game_end';

  const filteredGrid = { ...state.grid };
  Object.keys(filteredGrid).forEach(key => {
    const cell = filteredGrid[key];
    if (cell.isGoal && !cell.flipped) {
      const isRevealedByMap = !!state.revealedGoals[`${cell.x},${cell.y}_${playerId}`];
      if (!isRevealedByMap && !isRoundOver) {
        filteredGrid[key] = {
          ...cell,
          card: {
            id: 'goal_hidden',
            type: 'tunnel',
            name: 'Секретная цель',
            exits: { top: true, right: true, bottom: true, left: true },
            connectedParts: [['top', 'right', 'bottom', 'left']],
          },
        };
      }
    }
  });

  return {
    ...state,
    deck: [], 
    grid: filteredGrid,
    logs: state.logs.filter(log => !log.privateFor || log.privateFor === playerId),
    players: state.players.map(p => {
      const isMe = p.id === playerId;
      const isRoleRevealed = isMe || isRoundOver || !!state.revealedRoles[`${p.id}_${playerId}`];
      return {
        ...p,
        role: isRoleRevealed ? p.role : null,
        hand: (isMe || isRoundOver) ? p.hand : [],
      };
    }),
    goals: state.goals.map(g => {
      const isRevealed = g.flipped || isRoundOver || !!state.revealedGoals[`${g.x},${g.y}_${playerId}`];
      return {
        ...g,
        isGold: isRevealed ? g.isGold : false,
        card: isRevealed
          ? g.card
          : {
              id: 'goal_hidden',
              type: 'tunnel',
              name: 'Секретная цель',
              exits: { top: true, right: true, bottom: true, left: true },
              connectedParts: [['top', 'right', 'bottom', 'left']],
            },
      };
    }),
  };
};

export const usePeerGame = () => {
  const [roomCode, setRoomCode] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [gameState, setGameState] = useState<GameState | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const trueGameStateRef = useRef<GameState | null>(null);
  const myPlayerIdRef = useRef<string>('');
  const tttTimerIntervalRef = useRef<any>(null);

  const latestHandlerRef = useRef<any>(null);

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const addLog = (state: GameState, message: string, type: LogEntry['type'] = 'info', playerName?: string): GameState => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type,
      playerName,
    };
    return {
      ...state,
      logs: [newLog, ...state.logs].slice(0, 100),
    };
  };

  const connectWebSocket = (rCode: string, isHostRole: boolean, name: string, playerId: string) => {
    setConnectionStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('📡 Connecting to WebSocket server:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('📡 WebSocket connected! Sending JOIN_ROOM...');
      ws.send(JSON.stringify({
        type: 'JOIN_ROOM',
        roomId: rCode,
        isHost: isHostRole,
        playerId,
        playerName: name
      }));
      setConnectionStatus('connected');

      if (isHostRole) {
        const initialPlayer: Player = {
          id: playerId,
          name,
          isHost: true,
          role: null,
          brokenTools: [],
          hand: [],
          handSize: 0,
          maxHandSize: 6,
          score: 3, // Унифицировано: стартовый раунд дает 3 золота на баланс score
          active: true,
        };

        const initialGoals = getGoalTemplates().map((g, idx) => {
          return {
            x: 8,
            y: (idx - 1) * 2,
            isGold: g.isGold,
            flipped: false,
            card: g.card,
          };
        });

        const initialGrid: Record<string, PlacedCard> = {
          '0,0': {
            card: getEntranceCard(),
            rotated: false,
            x: 0,
            y: 0,
            isEntrance: true,
            flipped: true,
          },
        };

        initialGoals.forEach(g => {
          initialGrid[`${g.x},${g.y}`] = {
            card: g.card,
            rotated: false,
            x: g.x,
            y: g.y,
            isGoal: true,
            flipped: false,
          };
        });

        const initialFullState: GameState = {
          roomId: rCode,
          status: 'lobby',
          round: 1,
          players: [initialPlayer],
          grid: initialGrid,
          deckCount: 0,
          deck: [],
          discardPile: [],
          currentTurn: 0,
          hostId: playerId,
          goals: initialGoals,
          unusedRoles: [],
          logs: [],
          goldCardCount: 28,
          revealedGoals: {},
          revealedRoles: {},
        };

        const stateWithLog = addLog(initialFullState, `Комната создана! Код для входа: ${rCode}`, 'success');
        trueGameStateRef.current = stateWithLog;
        setGameState(filterStateForPlayer(stateWithLog, playerId));
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        latestHandlerRef.current?.(message);
      } catch (err) {
        console.error('❌ Error parsing WS message:', err);
      }
    };

    ws.onclose = () => {
      console.warn('⚠️ WebSocket connection closed. Reconnecting in 3s...');
      setConnectionStatus('disconnected');
      setTimeout(() => {
        if (wsRef.current === ws) {
          connectWebSocket(rCode, isHostRole, name, playerId);
        }
      }, 3000);
    };

    ws.onerror = (err) => {
      console.error('❌ WebSocket error:', err);
      setConnectionStatus('error');
      setErrorMessage('Не удалось связаться с игровым сервером.');
    };
  };

  const handleServerMessage = (message: any) => {
    console.log('📩 Incoming WS Message raw:', message);
    const { type } = message;
    const payload = message.payload || message;

    switch (type) {
      case 'GUEST_JOINED': {
        const guestId = payload.playerId || message.playerId;
        const guestName = payload.playerName || message.playerName;
        console.log('👥 Guest joined event:', guestId, guestName);
        handleJoinAction(guestId, guestName);
        break;
      }
      case 'CLIENT_ACTION': {
        const senderId = payload.senderId || message.senderId;
        const action = payload.action || message.action;
        console.log('⚡ Client action received from server:', senderId, action);
        if (senderId && action) {
          handleNetworkAction(senderId, action);
        } else {
          console.error('❌ Invalid CLIENT_ACTION structure:', message);
        }
        break;
      }
      case 'STATE_UPDATE': {
        const state = message.state || payload.state || payload;
        console.log('🔄 STATE_UPDATE processed:', state);
        setGameState(state as GameState);
        setConnectionStatus('connected');
        break;
      }
      case 'GUEST_LEFT': {
        const guestId = payload.playerId || message.playerId;
        console.log('👥 Guest left event:', guestId);
        handlePlayerDisconnect(guestId);
        break;
      }
      default:
        console.log('❓ Unknown WS packet type:', type);
    }
  };

  latestHandlerRef.current = handleServerMessage;

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (tttTimerIntervalRef.current) clearInterval(tttTimerIntervalRef.current);
    };
  }, []);

  const broadcastState = (fullState: GameState) => {
    console.log('📢 Broadcasting new GameState to all peers...', fullState);
    trueGameStateRef.current = fullState;

    const filteredHostState = filterStateForPlayer(fullState, myPlayerIdRef.current);
    setGameState(filteredHostState);

    fullState.players.forEach(p => {
      if (p.id === myPlayerIdRef.current) return;
      const filtered = filterStateForPlayer(fullState, p.id);
      
      console.log(`📡 Sending STATE_UPDATE to guest [${p.name}] (ID: ${p.id})`);
      wsRef.current?.send(JSON.stringify({
        type: 'STATE_UPDATE',
        roomId: fullState.roomId,
        targetId: p.id,
        state: filtered
      }));
    });
  };

  const createRoom = async (playerName: string) => {
    const code = generateRoomCode();
    setRoomCode(code);
    setIsHost(true);

    const hostPlayerId = Math.random().toString(36).substring(2, 9);
    myPlayerIdRef.current = hostPlayerId;
    console.log('👑 Creating room as Host. Generated ID:', hostPlayerId);

    connectWebSocket(code, true, playerName, hostPlayerId);
  };

  const joinRoom = async (code: string, playerName: string) => {
    const cleanedCode = code.toUpperCase();
    setRoomCode(cleanedCode);
    setIsHost(false);

    const myPeerId = getSessionClientId();
    myPlayerIdRef.current = myPeerId;
    console.log('👥 Joining room as Guest. Client ID:', myPeerId);

    connectWebSocket(cleanedCode, false, playerName, myPeerId);
  };

  const handleJoinAction = (clientId: string, name: string) => {
    const fullState = trueGameStateRef.current;
    if (!fullState) return;

    const existing = fullState.players.find(p => p.id === clientId);

    if (fullState.status !== 'lobby' && !existing) {
      return;
    }

    if (fullState.players.length >= 10 && !existing) {
      return;
    }

    if (existing) {
      existing.active = true;
      existing.name = name;

      let updatedState = addLog(fullState, `Игрок ${name} вернулся в игру!`, 'success');
      broadcastState(updatedState);
      return;
    }

    const newPlayer: Player = {
      id: clientId,
      name,
      isHost: false,
      role: null,
      brokenTools: [],
      hand: [],
      handSize: 0,
      maxHandSize: 6,
      score: 3, // Унифицировано: стартовый баланс равен 3
      active: true,
    };

    let updatedState = {
      ...fullState,
      players: [...fullState.players, newPlayer],
    };

    updatedState = addLog(updatedState, `Игрок ${name} присоединился к игре`, 'info');
    broadcastState(updatedState);
  };

  const handlePlayerDisconnect = (playerId: string) => {
    const fullState = trueGameStateRef.current;
    if (!fullState) return;

    const player = fullState.players.find(p => p.id === playerId);
    if (!player) return;

    player.active = false;

    let updatedState = addLog(fullState, `Игрок ${player.name} отключился`, 'warning');
    broadcastState(updatedState);
  };

  const startTTTTimer = () => {
    if (tttTimerIntervalRef.current) clearInterval(tttTimerIntervalRef.current);
    tttTimerIntervalRef.current = setInterval(() => {
      const fullState = trueGameStateRef.current;
      if (!fullState || !fullState.tttState || !fullState.tttState.active) {
        clearInterval(tttTimerIntervalRef.current);
        return;
      }

      const ttt = fullState.tttState;
      if (ttt.winnerId || ttt.isSpinningWheel) return;

      if (ttt.timeLeft > 1) {
        ttt.timeLeft -= 1;
        broadcastState(fullState);
      } else {
        ttt.timeLeft = 0;
        ttt.isSpinningWheel = true;
        let updated = addLog(fullState, `Время дуэли истекло! Колесо Фортуны решает исход!`, 'warning');
        broadcastState(updated);

        setTimeout(() => {
          resolveTTTWheel();
        }, 3000);
      }
    }, 1000);
  };

  const resolveTTTWheel = () => {
    const fullState = trueGameStateRef.current;
    if (!fullState || !fullState.tttState) return;

    const ttt = fullState.tttState;
    const loserChoice = Math.random() < 0.5 ? ttt.challengerId : ttt.targetId;
    const winnerChoice = loserChoice === ttt.challengerId ? ttt.targetId : ttt.challengerId;

    ttt.isSpinningWheel = false;
    ttt.winnerId = winnerChoice;

    const winner = fullState.players.find(p => p.id === winnerChoice);
    const loser = fullState.players.find(p => p.id === loserChoice);

    if (winner && loser) {
      winner.score += 3; // Унифицировано: победителю начисляем score
      loser.brokenTools = ['lamp', 'cart', 'pickaxe'];
      let updated = addLog(fullState, `🎡 Колесо выбрало проигравшим ${loser.name}! Все инструменты сломаны. ${winner.name} получил 3 золота!`, 'success');
      ttt.active = false;
      updated.tttState = undefined;
      broadcastState(nextTurn(updated));
    }
  };

  const handleNetworkAction = (senderId: string, action: NetworkAction) => {
    console.log('🎮 Processing network action:', senderId, action.type, action);
    const fullState = trueGameStateRef.current;
    if (!fullState) {
      console.error('❌ Action rejected: trueGameStateRef is null');
      return;
    }

    let updatedState = { ...fullState };
    const playerIndex = updatedState.players.findIndex(p => p.id === senderId);
    if (playerIndex === -1) {
      console.error('❌ Action rejected: sender not found in room players', senderId);
      return;
    }
    const player = updatedState.players[playerIndex];

    try {
      switch (action.type) {
        case 'START_GAME': {
          if (senderId !== updatedState.hostId) return;
          updatedState = startRound(updatedState, 1);
          break;
        }

        case 'PLAY_TUNNEL': {
          if (updatedState.status !== 'playing') {
            console.warn('❌ Action rejected: Game is not in playing status');
            return;
          }
          if (updatedState.currentTurn !== playerIndex) {
            console.warn(`❌ Action rejected: Not your turn! Active: ${updatedState.currentTurn}, You: ${playerIndex}`);
            return;
          }

          if (player.brokenTools.length > 0) {
            console.warn('❌ Action rejected: Player has broken tools');
            updatedState = addLog(updatedState, `${player.name}: Сначала почините инструмент!`, 'error');
            broadcastState(updatedState);
            return;
          }

          const { cardId, x, y, rotated } = action.payload;
          const cardIndex = player.hand.findIndex(c => c.id === cardId);
          if (cardIndex === -1) {
            console.warn('❌ Action rejected: Card not found in hand:', cardId);
            return;
          }
          const card = player.hand[cardIndex] as TunnelCard;

          const validation = validateTunnelPlacement(updatedState.grid, card, x, y, rotated);
          if (!validation.valid) {
            console.warn('❌ Action rejected: Tunnel placement invalid:', validation.reason);
            updatedState = addLog(updatedState, `${player.name}: Ошибка! ${validation.reason}`, 'error');
            broadcastState(updatedState);
            return;
          }

          const newPlaced: PlacedCard = { card, rotated, x, y };
          updatedState.grid[`${x},${y}`] = newPlaced;
          player.hand.splice(cardIndex, 1);
          player.handSize = player.hand.length;

          updatedState = addLog(updatedState, `${player.name} построил туннель на (${x}, ${y})`, 'info');

          if (updatedState.massActionState?.active && updatedState.massActionState.type === 'double_tunnel') {
            updatedState.massActionState.tunnelsPlaced += 1;
            updatedState = checkGoalReveal(updatedState, senderId);

            if (updatedState.status === 'playing') {
              if (updatedState.massActionState.tunnelsPlaced >= 2) {
                player.maxHandSize = Math.max(2, player.maxHandSize - 1);
                updatedState = addLog(updatedState, `Массовая постройка завершена! Лимит руки ${player.name} уменьшен до ${player.maxHandSize}`, 'warning');
                
                while (player.hand.length < player.maxHandSize && updatedState.deck.length > 0) {
                  player.hand.push(updatedState.deck.pop()!);
                }
                player.handSize = player.hand.length;
                updatedState.deckCount = updatedState.deck.length;

                updatedState.massActionState = undefined;
                updatedState = nextTurn(updatedState);
              }
            }
          } else {
            if (updatedState.deck.length > 0) {
              player.hand.push(updatedState.deck.pop()!);
            }
            player.handSize = player.hand.length;
            updatedState.deckCount = updatedState.deck.length;

            updatedState = checkGoalReveal(updatedState, senderId);
            if (updatedState.status === 'playing') {
              updatedState = nextTurn(updatedState);
            }
          }
          break;
        }

        case 'PLAY_ACTION': {
          if (updatedState.status !== 'playing') {
            console.warn('❌ Action rejected: Game status is not playing');
            return;
          }
          if (updatedState.currentTurn !== playerIndex) {
            console.warn(`❌ Action rejected: Not your turn! Active: ${updatedState.currentTurn}, You: ${playerIndex}`);
            return;
          }

          const { cardId, targetPlayerId, x, y, toolToRepair } = action.payload;

          if (updatedState.massActionState?.active) {
            if (updatedState.massActionState.type === 'double_cave_in') {
              if (x === undefined || y === undefined) return;
              const targetCoord = `${x},${y}`;
              const targetPlaced = updatedState.grid[targetCoord];

              if (!targetPlaced || targetPlaced.isEntrance || targetPlaced.isGoal) return;

              delete updatedState.grid[targetCoord];
              updatedState = addLog(updatedState, `${player.name} устроил обвал на (${x}, ${y})`, 'warning');

              updatedState.massActionState.caveInsDone += 1;
              if (updatedState.massActionState.caveInsDone >= 2) {
                player.maxHandSize = Math.max(2, player.maxHandSize - 1);
                updatedState = addLog(updatedState, `Двойной обвал завершен! Лимит руки уменьшен до ${player.maxHandSize}`, 'warning');
                
                while (player.hand.length < player.maxHandSize && updatedState.deck.length > 0) {
                  player.hand.push(updatedState.deck.pop()!);
                }
                player.handSize = player.hand.length;
                updatedState.deckCount = updatedState.deck.length;

                updatedState.massActionState = undefined;
                if (updatedState.status === 'playing') {
                  updatedState = nextTurn(updatedState);
                }
              }
              break;
            }

            if (updatedState.massActionState.type === 'double_map') {
              if (x === undefined || y === undefined) return;
              const targetGoal = updatedState.goals.find(g => g.x === x && g.y === y);
              if (!targetGoal || targetGoal.flipped) return;

              updatedState.revealedGoals[`${x},${y}_${senderId}`] = true;
              updatedState = addLog(updatedState, `${player.name} тайно посмотрел карту цели`, 'info');

              updatedState.massActionState.mapsViewed += 1;
              if (updatedState.massActionState.mapsViewed >= 2) {
                while (player.hand.length < player.maxHandSize && updatedState.deck.length > 0) {
                  player.hand.push(updatedState.deck.pop()!);
                }
                player.handSize = player.hand.length;
                updatedState.deckCount = updatedState.deck.length;

                updatedState.massActionState = undefined;
                if (updatedState.status === 'playing') {
                  updatedState = nextTurn(updatedState);
                }
              }
              break;
            }
          }

          const cardIndex = player.hand.findIndex(c => c.id === cardId);
          if (cardIndex === -1) {
            console.warn('❌ Action rejected: Action card not found in hand:', cardId);
            return;
          }
          const card = player.hand[cardIndex] as ActionCard;
          const targetPlayer = updatedState.players.find(p => p.id === targetPlayerId);

          if (card.actionType === 'break_tool') {
            if (!targetPlayer || !card.toolType) return;
            if (targetPlayer.brokenTools.includes(card.toolType)) return;

            targetPlayer.brokenTools.push(card.toolType);
            player.hand.splice(cardIndex, 1);
            player.handSize = player.hand.length;
            updatedState.discardPile.push(card);

            const toolName = card.toolType === 'lamp' ? 'фонарь' : card.toolType === 'cart' ? 'вагонетку' : 'кирку';
            updatedState = addLog(updatedState, `${player.name} сломал ${toolName} игроку ${targetPlayer.name}`, 'warning');

          } else if (card.actionType === 'repair_tool') {
            if (!targetPlayer) return;
            let repairTool: ToolType | undefined = card.toolType || toolToRepair;

            if (!repairTool || !targetPlayer.brokenTools.includes(repairTool)) return;

            targetPlayer.brokenTools = targetPlayer.brokenTools.filter(t => t !== repairTool);
            player.hand.splice(cardIndex, 1);
            player.handSize = player.hand.length;
            updatedState.discardPile.push(card);

            const toolName = repairTool === 'lamp' ? 'фонарь' : repairTool === 'cart' ? 'вагонетку' : 'кирку';
            updatedState = addLog(updatedState, `${player.name} починил ${toolName} игроку ${targetPlayer.name}`, 'success');

          } else if (card.actionType === 'view_role') {
            if (!targetPlayer) return;
            updatedState.revealedRoles[`${targetPlayer.id}_${senderId}`] = true;
            player.hand.splice(cardIndex, 1);
            player.handSize = player.hand.length;
            updatedState.discardPile.push(card);
            
            // Сначала добавляем публичный лог о факте просмотра
            updatedState = addLog(updatedState, `${player.name} тайно посмотрел роль ${targetPlayer.name}`, 'info');

            // Определяем роль в читаемом формате на русском языке
            const roleRu = targetPlayer.role === 'miner' 
              ? 'Шахтер ⛏️' 
              : targetPlayer.role === 'geologist' 
                ? 'Геолог 💎' 
                : 'Вредитель 👺';

            // Добавляем приватную запись в начало журнала логов, доступную только инициатору (senderId)
            updatedState.logs = [{
              id: Math.random().toString(36).substring(2, 9),
              timestamp: new Date().toLocaleTimeString(),
              message: `[СЕКРЕТНО] Роль игрока ${targetPlayer.name}: ${roleRu}`,
              type: 'success',
              privateFor: senderId
            }, ...updatedState.logs];

          } else if (card.actionType === 'swap_roles') {
            const tPlayer = targetPlayer || player;
            if (updatedState.unusedRoles.length > 0) {
              const oldRole = tPlayer.role;
              const newRole = updatedState.unusedRoles.pop()!;
              tPlayer.role = newRole;
              if (oldRole) updatedState.unusedRoles.push(oldRole);
              updatedState.unusedRoles.sort(() => Math.random() - 0.5);

              player.hand.splice(cardIndex, 1);
              player.handSize = player.hand.length;
              updatedState.discardPile.push(card);
              
              updatedState = addLog(updatedState, `${player.name} применил смену роли для ${tPlayer.name}`, 'warning');

              const roleRu = newRole === 'miner' ? 'Шахтер ⛏️' : newRole === 'geologist' ? 'Геолог 💎' : 'Вредитель 👺';
              updatedState.logs = [{
                id: Math.random().toString(36).substring(2, 9),
                timestamp: new Date().toLocaleTimeString(),
                message: `[СЕКРЕТНО] Ваша новая роль: ${roleRu}!`,
                type: 'success',
                privateFor: tPlayer.id
              }, ...updatedState.logs];
            }

          } else if (card.actionType === 'swap_cards') {
            if (!targetPlayer || targetPlayer.id === senderId) return;
            const tempHand = [...player.hand];
            tempHand.splice(cardIndex, 1);

            player.hand = [...targetPlayer.hand];
            targetPlayer.hand = tempHand;

            player.handSize = player.hand.length;
            targetPlayer.handSize = targetPlayer.hand.length;

            updatedState.discardPile.push(card);
            updatedState = addLog(updatedState, `${player.name} поменялся картами с ${targetPlayer.name}!`, 'warning');

          } else if (card.actionType === 'tic_tac_toe') {
            if (!targetPlayer || targetPlayer.id === senderId) return;
            player.hand.splice(cardIndex, 1);
            player.handSize = player.hand.length;
            updatedState.discardPile.push(card);

            updatedState.tttState = {
              active: true,
              challengerId: senderId,
              targetId: targetPlayer.id,
              board: Array(9).fill(null),
              currentTurnId: senderId,
              timeLimit: card.tttDuration || 15,
              timeLeft: card.tttDuration || 15,
            };

            updatedState = addLog(updatedState, `⚔️ ${player.name} вызвал ${targetPlayer.name} на дуэль в Крестики-Нолики!`, 'error');
            startTTTTimer();

          } else if (card.actionType === 'cave_in') {
            if (x === undefined || y === undefined) return;
            const targetCoord = `${x},${y}`;
            const targetPlaced = updatedState.grid[targetCoord];

            if (!targetPlaced || targetPlaced.isEntrance || targetPlaced.isGoal) return;

            delete updatedState.grid[targetCoord];
            player.hand.splice(cardIndex, 1);
            player.handSize = player.hand.length;
            updatedState.discardPile.push(card);

            updatedState = addLog(updatedState, `${player.name} устроил обвал на (${x}, ${y})`, 'warning');

            if (updatedState.massActionState?.active && updatedState.massActionState.type === 'double_cave_in') {
              updatedState.massActionState.caveInsDone += 1;
              if (updatedState.massActionState.caveInsDone >= 2) {
                player.maxHandSize = Math.max(2, player.maxHandSize - 1);
                updatedState = addLog(updatedState, `Двойной обвал завершен! Лимит руки уменьшен до ${player.maxHandSize}`, 'warning');
                
                while (player.hand.length < player.maxHandSize && updatedState.deck.length > 0) {
                  player.hand.push(updatedState.deck.pop()!);
                }
                player.handSize = player.hand.length;
                updatedState.deckCount = updatedState.deck.length;

                updatedState.massActionState = undefined;
                if (updatedState.status === 'playing') {
                  updatedState = nextTurn(updatedState);
                }
              }
            }

          } else if (card.actionType === 'map') {
            if (x === undefined || y === undefined) return;
            const targetGoal = updatedState.goals.find(g => g.x === x && g.y === y);
            if (!targetGoal || targetGoal.flipped) return;

            updatedState.revealedGoals[`${x},${y}_${senderId}`] = true;
            player.hand.splice(cardIndex, 1);
            player.handSize = player.hand.length;
            updatedState.discardPile.push(card);

            updatedState = addLog(updatedState, `${player.name} тайно посмотрел карту цели`, 'info');

            if (updatedState.massActionState?.active && updatedState.massActionState.type === 'double_map') {
              updatedState.massActionState.mapsViewed += 1;
              if (updatedState.massActionState.mapsViewed >= 2) {
                while (player.hand.length < player.maxHandSize && updatedState.deck.length > 0) {
                  player.hand.push(updatedState.deck.pop()!);
                }
                player.handSize = player.hand.length;
                updatedState.deckCount = updatedState.deck.length;

                updatedState.massActionState = undefined;
                if (updatedState.status === 'playing') {
                  updatedState = nextTurn(updatedState);
                }
              }
            }
          }

          if (!updatedState.massActionState) {
            if (player.hand.length < player.maxHandSize && updatedState.deck.length > 0) {
              player.hand.push(updatedState.deck.pop()!);
            }
            player.handSize = player.hand.length;
            updatedState.deckCount = updatedState.deck.length;

            updatedState = nextTurn(updatedState);
          }
          break;
        }

        case 'ACTIVATE_MASS_ACTION': {
          if (updatedState.status !== 'playing' || updatedState.currentTurn !== playerIndex) return;
          const { type, cardId1, cardId2 } = action.payload;

          if (type === 'double_tunnel') {
            updatedState.massActionState = { active: true, type: 'double_tunnel', tunnelsPlaced: 0, caveInsDone: 0, mapsViewed: 0 };
            updatedState = addLog(updatedState, `${player.name} готовит массовую постройку двух туннелей за -1 к лимиту руки`, 'warning');
          } else if (type === 'double_cave_in' && cardId1 && cardId2) {
            const idx1 = player.hand.findIndex(c => c.id === cardId1);
            const idx2 = player.hand.findIndex(c => c.id === cardId2);
            if (idx1 !== -1 && idx2 !== -1) {
              updatedState.discardPile.push(player.hand.splice(Math.max(idx1, idx2), 1)[0]);
              updatedState.discardPile.push(player.hand.splice(Math.min(idx1, idx2), 1)[0]);
              player.handSize = player.hand.length;

              updatedState.massActionState = { active: true, type: 'double_cave_in', tunnelsPlaced: 0, caveInsDone: 0, mapsViewed: 0 };
              updatedState = addLog(updatedState, `${player.name} пожертвовал картой и активировал Двойной Обвал (выберите 2 цели на поле)`, 'warning');
            }
          } else if (type === 'double_map' && cardId1 && cardId2) {
            const idx1 = player.hand.findIndex(c => c.id === cardId1);
            const idx2 = player.hand.findIndex(c => c.id === cardId2);
            if (idx1 !== -1 && idx2 !== -1) {
              updatedState.discardPile.push(player.hand.splice(Math.max(idx1, idx2), 1)[0]);
              updatedState.discardPile.push(player.hand.splice(Math.min(idx1, idx2), 1)[0]);
              player.handSize = player.hand.length;

              updatedState.massActionState = { active: true, type: 'double_map', tunnelsPlaced: 0, caveInsDone: 0, mapsViewed: 0 };
              updatedState = addLog(updatedState, `${player.name} сыграл 2 Секретных карты целей (выберите 2 цели на поле)`, 'info');
            }
          }
          break;
        }

        case 'CONFIRM_MASS_ACTION': {
          if (!updatedState.massActionState || updatedState.currentTurn !== playerIndex) return;
          const m = updatedState.massActionState;

          if (m.type === 'double_tunnel' || m.type === 'double_cave_in') {
            player.maxHandSize = Math.max(2, player.maxHandSize - 1);
          }

          while (player.hand.length < player.maxHandSize && updatedState.deck.length > 0) {
            player.hand.push(updatedState.deck.pop()!);
          }
          player.handSize = player.hand.length;
          updatedState.deckCount = updatedState.deck.length;

          updatedState.massActionState = undefined;
          updatedState = nextTurn(updatedState);
          break;
        }

        case 'TRANSFORM_CARD': {
          const { cardId, targetType, cost } = action.payload;
          if (player.score < cost) return; // Унифицировано: player.goldResources -> player.score

          const cardIdx = player.hand.findIndex(c => c.id === cardId);
          if (cardIdx === -1) return;

          player.score -= cost; // Унифицировано: player.goldResources -> player.score
          player.hand[cardIdx] = transformCard(player.hand[cardIdx], targetType);
          updatedState = addLog(updatedState, `${player.name} потратил ${cost} золота на преобразование карты в руке`, 'success');
          break;
        }

        case 'TTT_MOVE': {
          if (!updatedState.tttState) return;
          const ttt = updatedState.tttState;
          if (ttt.currentTurnId !== senderId) return;

          const { cellIndex } = action.payload;
          if (ttt.board[cellIndex] !== null) return;

          const mark = senderId === ttt.challengerId ? 'X' : 'O';
          ttt.board[cellIndex] = mark;

          const winnerMark = checkTTTWinner(ttt.board);
          if (winnerMark) {
            const winnerId = winnerMark === 'X' ? ttt.challengerId : ttt.targetId;
            const loserId = winnerId === ttt.challengerId ? ttt.targetId : ttt.challengerId;

            const winnerObj = updatedState.players.find(p => p.id === winnerId);
            const loserObj = updatedState.players.find(p => p.id === loserId);

            if (winnerObj && loserObj) {
              winnerObj.score += 3; // Унифицировано: winnerObj.goldResources -> winnerObj.score
              loserObj.brokenTools = ['lamp', 'cart', 'pickaxe'];
              updatedState = addLog(updatedState, `🎉 ${winnerObj.name} победил в Крестики-Нолики! Получено 3 золота. У ${loserObj.name} сломаны все инструменты!`, 'success');
            }

            if (tttTimerIntervalRef.current) clearInterval(tttTimerIntervalRef.current);
            updatedState.tttState = undefined;
            updatedState = nextTurn(updatedState);
          } else if (isTTTBoardFull(ttt.board)) {
            if (tttTimerIntervalRef.current) clearInterval(tttTimerIntervalRef.current);
            ttt.isSpinningWheel = true;
            updatedState = addLog(updatedState, `Ничья! Запускается Колесо Фортуны!`, 'warning');
            broadcastState(updatedState);

            setTimeout(() => {
              resolveTTTWheel();
            }, 3000);
            return;
          } else {
            ttt.currentTurnId = senderId === ttt.challengerId ? ttt.targetId : ttt.challengerId;
          }
          break;
        }

        case 'DISCARD': {
          if (updatedState.status !== 'playing') return;
          if (updatedState.currentTurn !== playerIndex) return;

          const { cardIds } = action.payload;
          if (!cardIds || cardIds.length === 0) return;

          cardIds.forEach(id => {
            const cardIndex = player.hand.findIndex(c => c.id === id);
            if (cardIndex !== -1) {
              const discardedCard = player.hand.splice(cardIndex, 1)[0];
              updatedState.discardPile.push(discardedCard);
            }
          });
          player.handSize = player.hand.length;

          updatedState = addLog(updatedState, `${player.name} сбросил карт: ${cardIds.length}`, 'info');

          // Убрано некорректное восстановление лимита руки до 6. 
          // Лимит (maxHandSize) теперь строго сохраняет свое уменьшенное значение до конца раунда.

          while (player.hand.length < player.maxHandSize && updatedState.deck.length > 0) {
            player.hand.push(updatedState.deck.pop()!);
          }
          player.handSize = player.hand.length;
          updatedState.deckCount = updatedState.deck.length;

          updatedState = nextTurn(updatedState);
          break;
        }

        case 'REPAIR_SELF_WITH_DISCARD': {
          if (updatedState.status !== 'playing') return;
          if (updatedState.currentTurn !== playerIndex) return;

          const { cardIds, toolToRepair } = action.payload;
          if (!cardIds || cardIds.length !== 2) return;

          const toolIdx = player.brokenTools.indexOf(toolToRepair);
          if (toolIdx === -1) return;

          cardIds.forEach(id => {
            const cardIndex = player.hand.findIndex(c => c.id === id);
            if (cardIndex !== -1) {
              const discardedCard = player.hand.splice(cardIndex, 1)[0];
              updatedState.discardPile.push(discardedCard);
            }
          });

          player.brokenTools.splice(toolIdx, 1);
          player.handSize = player.hand.length;

          player.maxHandSize = Math.max(2, player.maxHandSize - 1);

          const toolNameRu = toolToRepair === 'lamp' ? 'Фонарь' : toolToRepair === 'cart' ? 'Вагонетку' : 'Кирку';
          updatedState = addLog(updatedState, `${player.name} сбросил 2 карты (лимит руки -1) и починил свой инструмент: ${toolNameRu}`, 'success');

          while (player.hand.length < player.maxHandSize && updatedState.deck.length > 0) {
            player.hand.push(updatedState.deck.pop()!);
          }
          player.handSize = player.hand.length;
          updatedState.deckCount = updatedState.deck.length;

          updatedState = nextTurn(updatedState);
          break;
        }

        case 'SEND_CHAT': {
          const { message } = action.payload;
          updatedState = addLog(updatedState, message, 'chat', player.name);
          break;
        }

        case 'NEXT_ROUND': {
          if (senderId !== updatedState.hostId) return;
          if (updatedState.round >= 3) {
            updatedState.status = 'game_end';
            updatedState = addLog(updatedState, 'Игра завершена по итогам 3-х раундов!', 'success');
          } else {
            updatedState = startRound(updatedState, updatedState.round + 1);
          }
          break;
        }

        case 'RESTART_GAME': {
          if (senderId !== updatedState.hostId) return;
          updatedState.players.forEach(p => p.score = 0);
          updatedState = startRound(updatedState, 1);
          break;
        }
      }
    } catch (error: any) {
      console.error('❌ CRASH inside handleNetworkAction:', error);
      updatedState = addLog(updatedState, `System Error: ${error.message || error}`, 'error');
    }

    // Исправлено: Безусловно очищаем зависшие состояния массовых действий, если раунд закончился (или сменился статус)
    if (updatedState.status !== 'playing') {
      updatedState.massActionState = undefined;
    }

    const isActionFromGuest = senderId !== myPlayerIdRef.current;
    if (isActionFromGuest) {
      console.log('⏱️ Delaying broadcast State Update by 100ms for Guest network stability...');
      setTimeout(() => {
        broadcastState(updatedState);
      }, 100);
    } else {
      broadcastState(updatedState);
    }
  };

  const startRound = (state: GameState, roundNum: number): GameState => {
    let updated = { ...state };
    updated.status = 'playing';
    updated.round = roundNum;
    updated.discardPile = [];
    updated.revealedGoals = {};
    updated.revealedRoles = {};
    updated.winnerTeam = undefined;
    updated.massActionState = undefined; // Исправлено: Гарантированная очистка массового действия при рестарте/новом раунде

    updated.players.forEach(p => {
      p.brokenTools = [];
      p.hand = [];
      p.handSize = 0;
      p.maxHandSize = 6;
      p.score += 3; // Унифицировано: Каждому выдается по 3 золота на единый баланс
      p.isWinnerOfRound = false;
    });

    updated.deck = createFullDeck();

    const goalsList = getGoalTemplates().map((g, idx) => {
      const yCoord = (idx - 1) * 2;
      return {
        x: 8,
        y: yCoord,
        isGold: g.isGold,
        flipped: false,
        card: g.card,
      };
    });
    updated.goals = goalsList;

    const initialGrid: Record<string, PlacedCard> = {
      '0,0': {
        card: getEntranceCard(),
        rotated: false,
        x: 0,
        y: 0,
        isEntrance: true,
        flipped: true,
      },
    };

    goalsList.forEach(g => {
      initialGrid[`${g.x},${g.y}`] = {
        card: g.card,
        rotated: false,
        x: g.x,
        y: g.y,
        isGoal: true,
        flipped: false,
      };
    });
    updated.grid = initialGrid;

    const numPlayers = updated.players.length;
    let saboteursCount = 1;
    let geologistsCount = 1;
    let minersCount = 2;

    if (numPlayers >= 6) {
      saboteursCount = 2;
      geologistsCount = 2;
      minersCount = 3;
    } else if (numPlayers >= 8) {
      saboteursCount = 3;
      geologistsCount = 2;
      minersCount = 4;
    }

    const roles: ('miner' | 'saboteur' | 'geologist')[] = [];
    for (let i = 0; i < saboteursCount; i++) roles.push('saboteur');
    for (let i = 0; i < geologistsCount; i++) roles.push('geologist');
    for (let i = 0; i < minersCount; i++) roles.push('miner');

    roles.sort(() => Math.random() - 0.5);

    updated.players.forEach((p, idx) => {
      p.role = roles[idx] || 'miner';
    });

    updated.unusedRoles = roles.slice(numPlayers);

    updated.players.forEach(p => {
      for (let i = 0; i < p.maxHandSize; i++) {
        if (updated.deck.length > 0) {
          p.hand.push(updated.deck.pop()!);
        }
      }
      p.handSize = p.hand.length;
    });

    updated.deckCount = updated.deck.length;
    updated.currentTurn = Math.floor(Math.random() * numPlayers);

    updated = addLog(updated, `Раунд ${roundNum} начался! Каждому выдано 3 золота 🪙`, 'success');

    return updated;
  };

  const nextTurn = (state: GameState): GameState => {
    let updated = { ...state };
    let nextIdx = (updated.currentTurn + 1) % updated.players.length;
    let tries = 0;

    while (tries < updated.players.length) {
      const nextPlayer = updated.players[nextIdx];
      if (nextPlayer.active && (nextPlayer.hand.length > 0 || updated.deck.length > 0)) {
        updated.currentTurn = nextIdx;
        break;
      }
      nextIdx = (nextIdx + 1) % updated.players.length;
      tries++;
    }

    const allHandsEmpty = updated.players.every(p => !p.active || p.hand.length === 0);
    if (allHandsEmpty && updated.deck.length === 0) {
      updated = endRoundWithWinners(updated, 'saboteurs');
    }

    return updated;
  };

  const checkGoalReveal = (state: GameState, finisherId: string): GameState => {
    let updated = { ...state };
    const reachable = calculateReachability(updated.grid);

    let goldReached = false;

    updated.goals = updated.goals.map(g => {
      const key = `${g.x},${g.y}`;
      if (reachable.has(key) && !g.flipped) {
        const flippedPlaced: PlacedCard = {
          card: g.card,
          rotated: false,
          x: g.x,
          y: g.y,
          isGoal: true,
          flipped: true,
          isGold: g.isGold,
        } as any;
        updated.grid[key] = flippedPlaced;

        if (g.isGold) {
          goldReached = true;
          return { ...g, flipped: true };
        } else {
          updated = addLog(updated, `Открыта шахта цели на (${g.x}, ${g.y}) — там обычный камень!`, 'warning');
          return { ...g, flipped: true };
        }
      }
      return g;
    });

    if (goldReached) {
      updated = addLog(updated, `Золото найдено! Шахтеры победили в раунде!`, 'success');
      updated = endRoundWithWinners(updated, 'miners', finisherId);
    }

    return updated;
  };

  const endRoundWithWinners = (state: GameState, team: 'miners' | 'saboteurs' | 'geologists', finisherId?: string): GameState => {
    let updated = { ...state };
    updated.status = 'round_end';
    updated.winnerTeam = team;

    const reward: Record<string, number> = {};

    if (team === 'miners') {
      const miners = updated.players.filter(p => p.role === 'miner');
      miners.forEach(p => p.isWinnerOfRound = true);

      const nuggetVals: number[] = [];
      for (let i = 0; i < miners.length; i++) {
        nuggetVals.push(Math.floor(Math.random() * 3) + 1);
      }
      nuggetVals.sort((a, b) => b - a);

      let finisherIndex = miners.findIndex(p => p.id === finisherId);
      if (finisherIndex === -1) finisherIndex = 0;

      for (let i = 0; i < miners.length; i++) {
        const minerIdx = (finisherIndex + i) % miners.length;
        const playerObj = miners[minerIdx];
        const val = nuggetVals[i] || 1;
        playerObj.score += val;
        reward[playerObj.id] = val;
      }

      updated = addLog(updated, `Гномы-искатели получили золото!`, 'success');
    } else {
      const sabs = updated.players.filter(p => p.role === 'saboteur');
      sabs.forEach(p => p.isWinnerOfRound = true);

      let valuePerSab = 3;
      if (sabs.length === 1) valuePerSab = 4;
      else if (sabs.length >= 4) valuePerSab = 2;
      else if (sabs.length === 0) valuePerSab = 0;

      sabs.forEach(p => {
        p.score += valuePerSab;
        reward[p.id] = valuePerSab;
      });

      updated = addLog(updated, `Вредители победили в раунде! Каждый вредитель получил ${valuePerSab} золота.`, 'warning');
    }

    const geologists = updated.players.filter(p => p.role === 'geologist');
    if (geologists.length > 0) {
      let crystalsCount = 0;
      Object.values(updated.grid).forEach(cell => {
        if (cell.card && cell.card.hasCrystal) {
          crystalsCount++;
        }
      });

      const geologistReward = geologists.length > 0 ? Math.floor(crystalsCount / geologists.length) : 0;
      geologists.forEach(p => {
        p.score += geologistReward;
        reward[p.id] = (reward[p.id] || 0) + geologistReward;
      });

      updated = addLog(updated, `💎 Геологи получили по ${geologistReward} золота за кристаллы!`, 'success');
    }

    updated.roundGoldReward = reward;
    return updated;
  };

  const clientSendAction = (action: NetworkAction) => {
    console.log('🔌 sendAction called:', action.type, action);
    if (isHost) {
      console.log('👑 Host is executing local network action directly...');
      handleNetworkAction(myPlayerIdRef.current, action);
    } else {
      console.log('📡 Guest is transmitting CLIENT_ACTION packet to WS server...');
      wsRef.current?.send(JSON.stringify({
        type: 'CLIENT_ACTION',
        roomId: roomCode,
        senderId: myPlayerIdRef.current,
        action
      }));
    }
  };

  return {
    isHost,
    roomCode,
    connectionStatus,
    errorMessage,
    gameState,
    myPlayerId: myPlayerIdRef.current,
    createRoom,
    joinRoom,
    sendAction: clientSendAction,
  };
};