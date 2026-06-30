// src/peerManager.ts
import { useState, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { GameState, Player, Card, TunnelCard, ActionCard, PlacedCard, ToolType, LogEntry, NetworkAction, TTTGameState } from './types';
import {
  createFullDeck,
  getEntranceCard,
  getGoalTemplates,
  validateTunnelPlacement,
  calculateReachability,
} from './gameEngine';
import { canTransformCard, transformCard } from './goldEngine';
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

// 1. Обновленная фильтрация состояния игрока
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
    // Скрываем приватные логи других игроков
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


const getPeerConfig = (iceServers?: any[]) => {
  if (typeof window === 'undefined') return undefined;
  const host = window.location.hostname;
  const isLocalOrContainer = 
    host === 'localhost' || 
    host === '127.0.0.1' || 
    host.endsWith('.run.app') ||
    host.includes('web-preview') ||
    host.includes('aistudio');

  const iceConfig = {
    iceServers: iceServers && iceServers.length > 0 ? iceServers : [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  };

  if (isLocalOrContainer) {
    const secure = window.location.protocol === 'https:';
    const port = window.location.port ? parseInt(window.location.port, 10) : (secure ? 443 : 80);
    return { host, port, path: '/peerjs', secure, debug: 3, config: iceConfig };
  }

  return {
    host: 'niksan0011-saboteur-backend.hf.space', 
    port: 443,
    secure: true,
    path: '/peerjs',
    debug: 3,
    config: iceConfig,
  };
};

export const usePeerGame = () => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [gameState, setGameState] = useState<GameState | null>(null);

  const connectionsRef = useRef<Record<string, DataConnection>>({});
  const trueGameStateRef = useRef<GameState | null>(null);
  const myPlayerIdRef = useRef<string>('');
  const tttTimerIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (peer) peer.destroy();
      if (tttTimerIntervalRef.current) clearInterval(tttTimerIntervalRef.current);
    };
  }, [peer]);

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

  const broadcastState = (fullState: GameState) => {
    trueGameStateRef.current = fullState;
    const filteredHostState = filterStateForPlayer(fullState, myPlayerIdRef.current);
    setGameState(filteredHostState);

    Object.entries(connectionsRef.current).forEach(([pId, conn]) => {
      if (conn && conn.open) {
        try {
          const filtered = filterStateForPlayer(fullState, pId);
          conn.send({ type: 'STATE_UPDATE', payload: filtered });
        } catch (e) {
          console.warn(`Не удалось отправить состояние игроку ${pId}:`, e);
        }
      } else {
        delete connectionsRef.current[pId];
      }
    });
  };

  const createRoom = async (playerName: string) => {
    setConnectionStatus('connecting');
    const code = generateRoomCode();
    setRoomCode(code);
    setIsHost(true);

    const fullPeerId = `saboteur-room-${code}`;
    const newPeer = new Peer(fullPeerId, getPeerConfig([]));

    newPeer.on('open', (id) => {
      setPeerId(id);
      setConnectionStatus('connected');

      const hostPlayerId = Math.random().toString(36).substring(2, 9);
      myPlayerIdRef.current = hostPlayerId;

      const initialPlayer: Player = {
        id: hostPlayerId,
        name: playerName,
        isHost: true,
        role: null,
        brokenTools: [],
        hand: [],
        handSize: 0,
        maxHandSize: 6,
        score: 0,
        goldResources: 3, // Старт с 3 золота
        active: true,
      };

      const initialGoals = getGoalTemplates().map((g, idx) => {
        const yCoord = (idx - 1) * 2;
        return { x: 8, y: yCoord, isGold: g.isGold, flipped: false, card: g.card };
      });

      const initialGrid: Record<string, PlacedCard> = {
        '0,0': { card: getEntranceCard(), rotated: false, x: 0, y: 0, isEntrance: true, flipped: true },
      };

      initialGoals.forEach(g => {
        initialGrid[`${g.x},${g.y}`] = { card: g.card, rotated: false, x: g.x, y: g.y, isGoal: true, flipped: false };
      });

      const initialFullState: GameState = {
        roomId: code,
        status: 'lobby',
        round: 1,
        players: [initialPlayer],
        grid: initialGrid,
        deckCount: 0,
        deck: [],
        discardPile: [],
        currentTurn: 0,
        hostId: hostPlayerId,
        goals: initialGoals,
        unusedRoles: [],
        logs: [],
        goldCardCount: 28,
        revealedGoals: {},
        revealedRoles: {},
      };

      const stateWithLog = addLog(initialFullState, `Комната создана! Код: ${code}`, 'success');
      trueGameStateRef.current = stateWithLog;
      setGameState(filterStateForPlayer(stateWithLog, hostPlayerId));
    });

    newPeer.on('connection', (conn) => {
      conn.on('data', (data: any) => {
        if (!data || typeof data !== 'object') return;
        const msg = data as { type: string; payload?: any; senderId?: string };

        if (msg.type === 'JOIN') {
          handleJoinAction(conn, msg.payload.name);
        } else if (msg.senderId) {
          handleNetworkAction(msg.senderId, msg as NetworkAction);
        }
      });
      conn.on('close', () => handlePlayerDisconnect(conn.peer));
    });

    setPeer(newPeer);
  };

  const joinRoom = async (code: string, playerName: string) => {
    setConnectionStatus('connecting');
    setRoomCode(code.toUpperCase());
    setIsHost(false);

    const myPeerId = getSessionClientId();
    const newPeer = new Peer(myPeerId, getPeerConfig([]));

    const connectToHost = (peerInstance: Peer, rCode: string, pName: string) => {
      const hostId = `saboteur-room-${rCode}`;
      const conn = peerInstance.connect(hostId, { reliable: true });

      conn.on('open', () => {
        setConnectionStatus('connected');
        setErrorMessage('');
        connectionsRef.current[`host`] = conn;
        conn.send({ type: 'JOIN', payload: { name: pName } });
      });

      conn.on('data', (data: any) => {
        const msg = data as { type: string; payload: any };
        if (msg.type === 'STATE_UPDATE') {
          setGameState(msg.payload as GameState);
          setConnectionStatus('connected');
        } else if (msg.type === 'ERROR') {
          setErrorMessage(msg.payload || 'Ошибка подключения');
          setConnectionStatus('error');
        }
      });

      conn.on('close', () => {
        setConnectionStatus('connecting');
        setErrorMessage('Потеря связи. Попытка переподключения...');
        setTimeout(() => {
          if (!peerInstance.destroyed) connectToHost(peerInstance, rCode, pName);
        }, 3000);
      });
    };

    newPeer.on('open', (id) => {
      setPeerId(id);
      myPlayerIdRef.current = id;
      connectToHost(newPeer, code.toUpperCase(), playerName);
    });

    setPeer(newPeer);
  };

  const handleJoinAction = (conn: DataConnection, name: string) => {
    const fullState = trueGameStateRef.current;
    if (!fullState) return;

    const clientId = conn.peer;
    const existing = fullState.players.find(p => p.id === clientId);

    if (fullState.status !== 'lobby' && !existing) {
      conn.send({ type: 'ERROR', payload: 'Игра уже началась.' });
      conn.close();
      return;
    }

    if (existing) {
      existing.active = true;
      existing.name = name;
      connectionsRef.current[clientId] = conn;
      let updatedState = addLog(fullState, `Игрок ${name} вернулся!`, 'success');
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
      score: 0,
      goldResources: 3,
      active: true,
    };

    connectionsRef.current[clientId] = conn;
    let updatedState = { ...fullState, players: [...fullState.players, newPlayer] };
    updatedState = addLog(updatedState, `${name} вошел в лобби`, 'info');
    broadcastState(updatedState);
  };

  const handlePlayerDisconnect = (peerId: string) => {
    const fullState = trueGameStateRef.current;
    if (!fullState) return;

    const player = fullState.players.find(p => p.id === peerId);
    if (!player) return;

    player.active = false;
    delete connectionsRef.current[player.id];
    let updatedState = addLog(fullState, `Игрок ${player.name} отключился`, 'warning');
    broadcastState(updatedState);
  };

  // Механика Крестики-нолики & Колесо фортуны на Хосте
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
        // Время вышло -> Запускаем Колесо Фортуны
        ttt.timeLeft = 0;
        ttt.isSpinningWheel = true;
        let updated = addLog(fullState, `Время дуэли истекло! Запуск Колеса Фортуны!`, 'warning');
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
      winner.goldResources += 3;
      loser.brokenTools = ['lamp', 'cart', 'pickaxe'];
      let updated = addLog(fullState, `🎡 Колесо выбрало проигравшим ${loser.name}! Все его инструменты сломаны. ${winner.name} получил 3 золота!`, 'success');
      ttt.active = false;
      updated.tttState = undefined;
      broadcastState(nextTurn(updated));
    }
  };

  const handleNetworkAction = (senderId: string, action: NetworkAction) => {
    const fullState = trueGameStateRef.current;
    if (!fullState) return;

    let updatedState = { ...fullState };
    const playerIndex = updatedState.players.findIndex(p => p.id === senderId);
    if (playerIndex === -1 && action.type !== 'JOIN') return;
    const player = updatedState.players[playerIndex];

    switch (action.type) {
      case 'START_GAME': {
        if (senderId !== updatedState.hostId) return;
        updatedState = startRound(updatedState, 1);
        break;
      }

      case 'PLAY_TUNNEL': {
        if (updatedState.status !== 'playing') return;
        if (updatedState.currentTurn !== playerIndex) return;

        // Если идет массовый обвал или просмотр, блокируем постройку туннелей
        if (updatedState.massActionState?.active && updatedState.massActionState.type !== 'double_tunnel') return;

        if (player.brokenTools.length > 0) {
          updatedState = addLog(updatedState, `${player.name}: Инструменты сломаны!`, 'error');
          broadcastState(updatedState);
          return;
        }

        const { cardId, x, y, rotated } = action.payload;
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;
        const card = player.hand[cardIndex] as TunnelCard;

        const validation = validateTunnelPlacement(updatedState.grid, card, x, y, rotated);
        if (!validation.valid) {
          updatedState = addLog(updatedState, `Ошибка: ${validation.reason}`, 'error');
          broadcastState(updatedState);
          return;
        }

        updatedState.grid[`${x},${y}`] = { card, rotated, x, y };
        player.hand.splice(cardIndex, 1);
        player.handSize = player.hand.length;

        updatedState = addLog(updatedState, `${player.name} проложил туннель на (${x}, ${y})`, 'info');

        // Обработка массового действия (Двойной туннель)
        if (updatedState.massActionState?.active && updatedState.massActionState.type === 'double_tunnel') {
          updatedState.massActionState.tunnelsPlaced += 1;
          if (updatedState.massActionState.tunnelsPlaced >= 2) {
            // Лимит уменьшается на 1 карту перманентно
            player.maxHandSize = Math.max(2, player.maxHandSize - 1);
            updatedState = addLog(updatedState, `Массовый ход завершен! Максимум руки ${player.name} уменьшен до ${player.maxHandSize}`, 'warning');
            
            // Восполнение до нового лимита рук
            while (player.hand.length < player.maxHandSize && updatedState.deck.length > 0) {
              player.hand.push(updatedState.deck.pop()!);
            }
            player.handSize = player.hand.length;
            updatedState.deckCount = updatedState.deck.length;

            updatedState.massActionState = undefined;
            updatedState = checkGoalReveal(updatedState, senderId);
            if (updatedState.status === 'playing') updatedState = nextTurn(updatedState);
          }
        } else {
          // Обычный ход
          if (updatedState.deck.length > 0) {
            player.hand.push(updatedState.deck.pop()!);
          }
          player.handSize = player.hand.length;
          updatedState.deckCount = updatedState.deck.length;

          updatedState = checkGoalReveal(updatedState, senderId);
          if (updatedState.status === 'playing') updatedState = nextTurn(updatedState);
        }
        break;
      }

      case 'PLAY_ACTION': {
        if (updatedState.status !== 'playing') return;
        if (updatedState.currentTurn !== playerIndex) return;

        const { cardId, targetPlayerId, x, y, toolToRepair } = action.payload;
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;
        const card = player.hand[cardIndex] as ActionCard;

        const targetPlayer = updatedState.players.find(p => p.id === targetPlayerId);

        // Поломка
        if (card.actionType === 'break_tool') {
          if (!targetPlayer || !card.toolType) return;
          if (targetPlayer.brokenTools.includes(card.toolType)) return;
          targetPlayer.brokenTools.push(card.toolType);
          player.hand.splice(cardIndex, 1);
          updatedState.discardPile.push(card);
          updatedState = addLog(updatedState, `${player.name} сломал инструмент ${targetPlayer.name}`, 'warning');
          
        // Починка
        } else if (card.actionType === 'repair_tool') {
          if (!targetPlayer) return;
          let repairTool = card.toolType || toolToRepair;
          if (!repairTool || !targetPlayer.brokenTools.includes(repairTool)) return;
          targetPlayer.brokenTools = targetPlayer.brokenTools.filter(t => t !== repairTool);
          player.hand.splice(cardIndex, 1);
          updatedState.discardPile.push(card);
          updatedState = addLog(updatedState, `${player.name} починил инструмент ${targetPlayer.name}`, 'success');

        // Просмотр роли (SAB2)
        } else if (card.actionType === 'view_role') {
          if (!targetPlayer) return;
          updatedState.revealedRoles[`${targetPlayer.id}_${senderId}`] = true;
          player.hand.splice(cardIndex, 1);
          updatedState.discardPile.push(card);
          updatedState = addLog(updatedState, `${player.name} тайно узнал роль ${targetPlayer.name}`, 'info');

        // Смена роли (SAB2)
        } else if (card.actionType === 'swap_roles') {
          const tPlayer = targetPlayer || player;
          if (updatedState.unusedRoles.length > 0) {
            const oldRole = tPlayer.role;
            const newRole = updatedState.unusedRoles.pop()!;
            tPlayer.role = newRole;
            if (oldRole) updatedState.unusedRoles.push(oldRole);
            updatedState.unusedRoles.sort(() => Math.random() - 0.5);

            player.hand.splice(cardIndex, 1);
            updatedState.discardPile.push(card);

            // Публичный лог о событии
            updatedState = addLog(updatedState, `${player.name} сменил роль игроку ${tPlayer.name}`, 'warning');

            // Приватное уведомление только для игрока, получившего новую роль
            const roleRu = newRole === 'miner' ? 'Искатель Золота ⛏️' : newRole === 'geologist' ? 'Геолог 💎' : 'Вредитель 👺';
            const privateLog: LogEntry = {
              id: Math.random().toString(36).substring(2, 9),
              timestamp: new Date().toLocaleTimeString(),
              message: `[СЕКРЕТНО] Ваша новая роль: ${roleRu}!`,
              type: 'success',
              privateFor: tPlayer.id // Будет видно только ему
            };
            updatedState.logs = [privateLog, ...updatedState.logs];
          }
        } else if (card.actionType === 'swap_cards') {
          if (!targetPlayer || targetPlayer.id === senderId) return;
          const tempHand = [...player.hand];
          // Карту обмена изымаем перед обменом
          tempHand.splice(cardIndex, 1);

          player.hand = [...targetPlayer.hand];
          targetPlayer.hand = tempHand;

          player.handSize = player.hand.length;
          targetPlayer.handSize = targetPlayer.hand.length;

          updatedState.discardPile.push(card);
          updatedState = addLog(updatedState, `${player.name} совершил обмен картами с ${targetPlayer.name}!`, 'warning');

        // Дуэль в Крестики-нолики
        } else if (card.actionType === 'tic_tac_toe') {
          if (!targetPlayer || targetPlayer.id === senderId) return;
          player.hand.splice(cardIndex, 1);
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

        // Обвал туннеля
        } else if (card.actionType === 'cave_in') {
          if (x === undefined || y === undefined) return;
          const targetCoord = `${x},${y}`;
          const targetPlaced = updatedState.grid[targetCoord];

          if (!targetPlaced || targetPlaced.isEntrance || targetPlaced.isGoal) return;

          delete updatedState.grid[targetCoord];
          player.hand.splice(cardIndex, 1);
          updatedState.discardPile.push(card);
          updatedState = addLog(updatedState, `${player.name} устроил обвал на (${x}, ${y})`, 'warning');

          // Учет массового хода (Двойной обвал)
          if (updatedState.massActionState?.active && updatedState.massActionState.type === 'double_cave_in') {
            updatedState.massActionState.caveInsDone += 1;
            if (updatedState.massActionState.caveInsDone >= 2) {
              player.maxHandSize = Math.max(2, player.maxHandSize - 1);
              updatedState = addLog(updatedState, `Массовый обвал завершен! Лимит руки уменьшен до ${player.maxHandSize}`, 'warning');
              
              while (player.hand.length < player.maxHandSize && updatedState.deck.length > 0) {
                player.hand.push(updatedState.deck.pop()!);
              }
              player.handSize = player.hand.length;
              updatedState.deckCount = updatedState.deck.length;

              updatedState.massActionState = undefined;
              if (updatedState.status === 'playing') updatedState = nextTurn(updatedState);
            }
            broadcastState(updatedState);
            return;
          }

        // Карта просмотра
        } else if (card.actionType === 'map') {
          if (x === undefined || y === undefined) return;
          const targetGoal = updatedState.goals.find(g => g.x === x && g.y === y);
          if (!targetGoal || targetGoal.flipped) return;

          updatedState.revealedGoals[`${x},${y}_${senderId}`] = true;
          player.hand.splice(cardIndex, 1);
          updatedState.discardPile.push(card);
          updatedState = addLog(updatedState, `${player.name} тайно подсмотрел цель`, 'info');

          // Учет массового хода (Двойной просмотр)
          if (updatedState.massActionState?.active && updatedState.massActionState.type === 'double_map') {
            updatedState.massActionState.mapsViewed += 1;
            if (updatedState.massActionState.mapsViewed >= 2) {
              // БЕЗ уменьшения лимита карт
              while (player.hand.length < player.maxHandSize && updatedState.deck.length > 0) {
                player.hand.push(updatedState.deck.pop()!);
              }
              player.handSize = player.hand.length;
              updatedState.deckCount = updatedState.deck.length;

              updatedState.massActionState = undefined;
              if (updatedState.status === 'playing') updatedState = nextTurn(updatedState);
            }
            broadcastState(updatedState);
            return;
          }
        }

        // Автодобор обычного хода
        if (player.hand.length < player.maxHandSize && updatedState.deck.length > 0) {
          player.hand.push(updatedState.deck.pop()!);
        }
        player.handSize = player.hand.length;
        updatedState.deckCount = updatedState.deck.length;

        updatedState = nextTurn(updatedState);
        break;
      }

      case 'ACTIVATE_MASS_ACTION': {
        if (updatedState.status !== 'playing' || updatedState.currentTurn !== playerIndex) return;
        const { type, cardId1, cardId2 } = action.payload;

        if (type === 'double_tunnel') {
          updatedState.massActionState = { active: true, type: 'double_tunnel', tunnelsPlaced: 0, caveInsDone: 0, mapsViewed: 0 };
          updatedState = addLog(updatedState, `${player.name} готовит массовую постройку двух туннелей за -1 к лимиту руки`, 'warning');
        } else if (type === 'double_cave_in' && cardId1 && cardId2) {
          // Изымаем карту обвала и карту пожертвования
          const idx1 = player.hand.findIndex(c => c.id === cardId1);
          const idx2 = player.hand.findIndex(c => c.id === cardId2);
          if (idx1 !== -1 && idx2 !== -1) {
            player.hand.splice(Math.max(idx1, idx2), 1);
            player.hand.splice(Math.min(idx1, idx2), 1);
            player.handSize = player.hand.length;

            updatedState.massActionState = { active: true, type: 'double_cave_in', tunnelsPlaced: 0, caveInsDone: 0, mapsViewed: 0 };
            updatedState = addLog(updatedState, `${player.name} пожертвовал картой и активировал Двойной Обвал (кликните по 2 туннелям)`, 'warning');
          }
        } else if (type === 'double_map' && cardId1 && cardId2) {
          const idx1 = player.hand.findIndex(c => c.id === cardId1);
          const idx2 = player.hand.findIndex(c => c.id === cardId2);
          if (idx1 !== -1 && idx2 !== -1) {
            player.hand.splice(Math.max(idx1, idx2), 1);
            player.hand.splice(Math.min(idx1, idx2), 1);
            player.handSize = player.hand.length;

            updatedState.massActionState = { active: true, type: 'double_map', tunnelsPlaced: 0, caveInsDone: 0, mapsViewed: 0 };
            updatedState = addLog(updatedState, `${player.name} сыграл 2 Секретных карты (выберите 2 цели на поле)`, 'info');
          }
        }
        break;
      }

      case 'CONFIRM_MASS_ACTION': {
        // Кнопка подтверждения прерывает серию шагов раньше времени
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
        if (player.goldResources < cost) return;

        const cardIdx = player.hand.findIndex(c => c.id === cardId);
        if (cardIdx === -1) return;

        const check = canTransformCard(player.hand[cardIdx], targetType, player.goldResources);
        if (check.can) {
          player.goldResources -= cost;
          player.hand[cardIdx] = transformCard(player.hand[cardIdx], targetType);
          updatedState = addLog(updatedState, `${player.name} потратил ${cost} золота на преобразование карты в руке`, 'success');
        }
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

          const winner = updatedState.players.find(p => p.id === winnerId);
          const loser = updatedState.players.find(p => p.id === loserId);

          if (winner && loser) {
            winner.goldResources += 3;
            loser.brokenTools = ['lamp', 'cart', 'pickaxe'];
            updatedState = addLog(updatedState, `🎉 ${winner.name} победил в Крестики-Нолики! Получено 3 золота. У ${loser.name} сломаны все инструменты!`, 'success');
          }

          if (tttTimerIntervalRef.current) clearInterval(tttTimerIntervalRef.current);
          updatedState.tttState = undefined;
          updatedState = nextTurn(updatedState);
        } else if (isTTTBoardFull(ttt.board)) {
          // Ничья -> Колесо фортуны
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
        if (updatedState.status !== 'playing' || updatedState.currentTurn !== playerIndex) return;
        const { cardIds } = action.payload;
        if (!cardIds || cardIds.length === 0) return;

        cardIds.forEach(id => {
          const cardIndex = player.hand.findIndex(c => c.id === id);
          if (cardIndex !== -1) {
            updatedState.discardPile.push(player.hand.splice(cardIndex, 1)[0]);
          }
        });

        updatedState = addLog(updatedState, `${player.name} сбросил карт: ${cardIds.length}`, 'info');

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

    broadcastState(updatedState);
  };

  const startRound = (state: GameState, roundNum: number): GameState => {
    let updated = { ...state };
    updated.status = 'playing';
    updated.round = roundNum;
    updated.discardPile = [];
    updated.revealedGoals = {};
    updated.revealedRoles = {};
    updated.winnerTeam = undefined;

    updated.players.forEach(p => {
      p.brokenTools = [];
      p.hand = [];
      p.maxHandSize = 6;
      p.goldResources = 3; // Каждому 3 золота на раунд
    });

    updated.deck = createFullDeck();

    const goalsList = getGoalTemplates().map((g, idx) => {
      return { x: 8, y: (idx - 1) * 2, isGold: g.isGold, flipped: false, card: g.card };
    });
    updated.goals = goalsList;

    const initialGrid: Record<string, PlacedCard> = {
      '0,0': { card: getEntranceCard(), rotated: false, x: 0, y: 0, isEntrance: true, flipped: true },
    };
    goalsList.forEach(g => {
      initialGrid[`${g.x},${g.y}`] = { card: g.card, rotated: false, x: g.x, y: g.y, isGoal: true, flipped: false };
    });
    updated.grid = initialGrid;

    // Пул ролей: золотоискатели, вредители и геологи
    const numPlayers = updated.players.length;
    let sabs = 1;
    let geologists = 1;
    let miners = 2;

    if (numPlayers >= 6) { sabs = 2; geologists = 2; miners = 3; }
    else if (numPlayers >= 8) { sabs = 3; geologists = 2; miners = 4; }

    const rolesPool: ('miner' | 'saboteur' | 'geologist')[] = [];
    for (let i = 0; i < sabs; i++) rolesPool.push('saboteur');
    for (let i = 0; i < geologists; i++) rolesPool.push('geologist');
    for (let i = 0; i < miners; i++) rolesPool.push('miner');

    rolesPool.sort(() => Math.random() - 0.5);

    updated.players.forEach((p, idx) => {
      p.role = rolesPool[idx] || 'miner';
    });

    // Оставшиеся роли уходят в неиспользуемые (для смены роли)
    updated.unusedRoles = rolesPool.slice(numPlayers);

    updated.players.forEach(p => {
      for (let i = 0; i < p.maxHandSize; i++) {
        if (updated.deck.length > 0) p.hand.push(updated.deck.pop()!);
      }
      p.handSize = p.hand.length;
    });

    updated.deckCount = updated.deck.length;
    updated.currentTurn = Math.floor(Math.random() * numPlayers);

    updated = addLog(updated, `Раунд ${roundNum} начался! Каждому гному выдано 3 золота 🪙`, 'success');
    return updated;
  };

  const nextTurn = (state: GameState): GameState => {
    let updated = { ...state };
    let nextIdx = (updated.currentTurn + 1) % updated.players.length;
    let tries = 0;

    while (tries < updated.players.length) {
      const nextPlayer = updated.players[nextIdx];
      if (nextPlayer.active) {
        updated.currentTurn = nextIdx;
        break;
      }
      nextIdx = (nextIdx + 1) % updated.players.length;
      tries++;
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
        } else {
          updated = addLog(updated, `Туннель вывел к пустышке на (${g.x}, ${g.y})`, 'warning');
        }
        return { ...g, flipped: true };
      }
      return g;
    });

    if (goldReached) {
      updated = addLog(updated, `Золотая жила найдена! Шахтеры празднуют победу!`, 'success');
      updated = endRoundWithWinners(updated, 'miners', finisherId);
    }
    return updated;
  };

  const endRoundWithWinners = (state: GameState, team: 'miners' | 'saboteurs' | 'geologists', finisherId?: string): GameState => {
    let updated = { ...state };
    updated.status = 'round_end';
    updated.winnerTeam = team;

    const reward: Record<string, number> = {};

    // 1. Начисление шахтерам/вредителям
    if (team === 'miners') {
      const minersList = updated.players.filter(p => p.role === 'miner');
      minersList.forEach(p => {
        const rewardAmount = Math.floor(Math.random() * 3) + 2;
        p.score += rewardAmount;
        reward[p.id] = rewardAmount;
      });
    } else {
      const sabsList = updated.players.filter(p => p.role === 'saboteur');
      sabsList.forEach(p => {
        const rewardAmount = 4;
        p.score += rewardAmount;
        reward[p.id] = rewardAmount;
      });
    }

    // 2. Расчет очков Геологам (подсчитываем кристаллы на поле)
    const geologistsList = updated.players.filter(p => p.role === 'geologist');
    if (geologistsList.length > 0) {
      let crystalsCount = 0;
      Object.values(updated.grid).forEach(cell => {
        if (cell.card && cell.card.hasCrystal) {
          crystalsCount++;
        }
      });

      const geologistReward = geologistsList.length > 0 ? Math.floor(crystalsCount / geologistsList.length) : 0;
      geologistsList.forEach(p => {
        p.score += geologistReward;
        reward[p.id] = (reward[p.id] || 0) + geologistReward;
      });

      updated = addLog(updated, `💎 Геологи получают по ${geologistReward} золота за найденные кристаллы (${crystalsCount} шт. на поле)!`, 'success');
    }

    updated.roundGoldReward = reward;
    return updated;
  };

  const clientSendAction = (action: NetworkAction) => {
    if (isHost) {
      handleNetworkAction(myPlayerIdRef.current, action);
    } else {
      const hostConn = connectionsRef.current[`host`];
      if (hostConn && hostConn.open) {
        hostConn.send({ ...action, senderId: peerId });
      }
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