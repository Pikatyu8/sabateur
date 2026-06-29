import { useState, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { GameState, Player, Card, TunnelCard, ActionCard, PlacedCard, ToolType, LogEntry, NetworkAction } from './types';
import {
  createFullDeck,
  getEntranceCard,
  getGoalTemplates,
  validateTunnelPlacement,
  calculateReachability,
  getOpposingDir
} from './gameEngine';

// Изолированное получение/сохранение уникального ID для вкладки
const getSessionClientId = () => {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem('saboteur_peer_id');
  if (!id) {
    id = `sab-player-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
    sessionStorage.setItem('saboteur_peer_id', id);
  }
  return id;
};

// Обновленная функция фильтрации (добавлено маскирование grid для защиты от читов)
export const filterStateForPlayer = (state: GameState, playerId: string): GameState => {
  const isRoundOver = state.status === 'round_end' || state.status === 'game_end';

  // Маскируем неоткрытые цели на игровом поле, чтобы клиенты не знали заранее, где золото
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
    deck: [], // Clear the actual deck
    grid: filteredGrid,
    players: state.players.map(p => {
      const isMe = p.id === playerId;
      return {
        ...p,
        role: (isMe || isRoundOver) ? p.role : null,
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
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' }
    ]
  };

  if (isLocalOrContainer) {
    const secure = window.location.protocol === 'https:';
    const port = window.location.port ? parseInt(window.location.port, 10) : (secure ? 443 : 80);
    return {
      host,
      port,
      path: '/peerjs',
      secure,
      debug: 3,
      config: iceConfig,
    };
  }

  return {
    host: 'niksan0011-saboteur-backend.hf.space', 
    port: 443,
    secure: true,
    path: '/peerjs',
    debug: 3,
    config: iceConfig,
  };
}

const getBackendUrl = () => {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  const isLocalOrContainer = 
    host === 'localhost' || 
    host === '127.0.0.1' || 
    host.endsWith('.run.app') ||
    host.includes('web-preview') ||
    host.includes('aistudio');

  return isLocalOrContainer ? '' : 'https://niksan0011-saboteur-backend.hf.space';
};

const fetchIceServers = async (): Promise<any[]> => {
  try {
    const baseUrl = getBackendUrl();
    const response = await fetch(`${baseUrl}/api/ice-servers`);
    if (!response.ok) throw new Error();
    return await response.json();
  } catch (e) {
    console.warn('Не удалось получить TURN-серверы, откат к Google STUN:', e);
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' }
    ];
  }
};


export const usePeerGame = () => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Authorized local state (full state for the host, filtered state for the client)
  const [gameState, setGameState] = useState<GameState | null>(null);

  // References for host to track active connections
  const connectionsRef = useRef<Record<string, DataConnection>>({});
  const trueGameStateRef = useRef<GameState | null>(null);
  const myPlayerIdRef = useRef<string>('');

  // Clean up connections on unmount
  useEffect(() => {
    return () => {
      if (peer) {
        peer.destroy();
      }
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

  // Log helper
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
      logs: [newLog, ...state.logs].slice(0, 100), // Keep last 100 logs
    };
  };

  // Broadcaster for host to send state updates to all clients
  const broadcastState = (fullState: GameState) => {
    trueGameStateRef.current = fullState;

    // First update own host state (filtered for self so host can't cheat either!)
    const filteredHostState = filterStateForPlayer(fullState, myPlayerIdRef.current);
    setGameState(filteredHostState);

    // Send filtered state to each connected peer
    Object.entries(connectionsRef.current).forEach(([pId, conn]) => {
      if (conn && conn.open) {
        try {
          const filtered = filterStateForPlayer(fullState, pId);
          conn.send({ type: 'STATE_UPDATE', payload: filtered });
        } catch (e) {
          console.warn(`Не удалось отправить состояние игроку ${pId}:`, e);
        }
      } else {
        // Cleanup closed connections
        delete connectionsRef.current[pId];
      }
    });
  };

  // HOST: Initialize Room
  const createRoom = async (playerName: string) => {
    setConnectionStatus('connecting');
    const code = generateRoomCode();
    setRoomCode(code);
    setIsHost(true);

    const iceServers = await fetchIceServers();
    const fullPeerId = `saboteur-room-${code}`;
    const newPeer = new Peer(fullPeerId, getPeerConfig(iceServers));

    newPeer.on('open', (id) => {
      setPeerId(id);
      setConnectionStatus('connected');

      // Create initial host game state
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
        score: 0,
        active: true,
      };

      const initialGoals = getGoalTemplates().map((g, idx) => {
        const yCoord = (idx - 1) * 2;
        return {
          x: 8,
          y: yCoord,
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
        logs: [],
        goldCardCount: 28,
        revealedGoals: {},
      };

      const stateWithLog = addLog(initialFullState, `Комната создана! Код для входа: ${code}`, 'success');
      trueGameStateRef.current = stateWithLog;
      setGameState(filterStateForPlayer(stateWithLog, hostPlayerId));
    });

    newPeer.on('connection', (conn) => {
      conn.on('open', () => {
        // A client connected, wait for JOIN message
      });

      conn.on('data', (data: any) => {
        if (!data || typeof data !== 'object') return;
        const msg = data as { type: string; payload?: any; senderId?: string };

        if (msg.type === 'JOIN') {
          handleJoinAction(conn, msg.payload.name);
        } else if (msg.senderId) {
          handleNetworkAction(msg.senderId, msg as NetworkAction);
        }
      });

      conn.on('close', () => {
        handlePlayerDisconnect(conn.peer);
      });

      conn.on('error', () => {
        handlePlayerDisconnect(conn.peer);
      });
    });

    // Автоматическое переподключение хоста к сигнальному серверу при разрыве сокета
    newPeer.on('disconnected', () => {
      console.warn('Хост: Соединение с сигнальным сервером PeerJS разорвано. Попытка переподключения...');
      const reconnectInterval = setInterval(() => {
        if (newPeer.destroyed) {
          clearInterval(reconnectInterval);
          return;
        }
        if (newPeer.disconnected) {
          newPeer.reconnect();
        } else {
          clearInterval(reconnectInterval);
        }
      }, 5000);
    });

    newPeer.on('error', (err) => {
      console.error(err);
      if (err.type === 'network') {
        console.warn('Хост: Сетевая ошибка сигнального сервера, пробуем восстановить...');
        if (!newPeer.destroyed && newPeer.disconnected) {
          newPeer.reconnect();
        }
      } else {
        setConnectionStatus('error');
        setErrorMessage(`Ошибка PeerJS: ${err.type === 'unavailable-id' ? 'Код комнаты уже занят' : err.message}`);
      }
    });

    setPeer(newPeer);
  };

  // CLIENT: Join Room
  const joinRoom = async (code: string, playerName: string) => {
    setConnectionStatus('connecting');
    setRoomCode(code.toUpperCase());
    setIsHost(false);

    const iceServers = await fetchIceServers();
    const myPeerId = getSessionClientId(); // Используем sessionStorage ID для стабильного реконнекта
    const newPeer = new Peer(myPeerId, getPeerConfig(iceServers));

    // Функция подключения/переподключения к хосту через WebRTC Data Channel
    const connectToHost = (peerInstance: Peer, rCode: string, pName: string) => {
      const hostId = `saboteur-room-${rCode}`;
      const conn = peerInstance.connect(hostId, { reliable: true });
      let pingInterval: any;

      conn.on('open', () => {
        setConnectionStatus('connected');
        setErrorMessage('');

        // Сохраняем соединение
        connectionsRef.current[`host`] = conn;

        // Отсылаем JOIN-пакет
        conn.send({ type: 'JOIN', payload: { name: pName } });

        // Запуск Heartbeat (пинг каждые 15 сек) для предотвращения засыпания соединения
        pingInterval = setInterval(() => {
          if (conn.open) {
            conn.send({ type: 'PING' });
          } else {
            clearInterval(pingInterval);
          }
        }, 15000);
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
        clearInterval(pingInterval);
        console.warn('Клиент: Соединение с хостом закрыто. Попытка восстановить через 3 секунды...');
        
        // Переводим интерфейс в состояние загрузки, но не стираем локальную карту, чтобы не ломать экран
        setConnectionStatus('connecting');
        setErrorMessage('Связь с сервером прервана. Пытаемся восстановить соединение...');

        setTimeout(() => {
          if (!peerInstance.destroyed) {
            connectToHost(peerInstance, rCode, pName);
          }
        }, 3000);
      });

      conn.on('error', (err) => {
        console.error('Ошибка WebRTC канала:', err);
        conn.close();
      });
    };

    newPeer.on('open', (myPeerId) => {
      setPeerId(myPeerId);
      myPlayerIdRef.current = myPeerId;
      connectToHost(newPeer, code.toUpperCase(), playerName);
    });

    // Клиент: Автопереподключение к сигнальному серверу PeerJS при дисконнекте сокета
    newPeer.on('disconnected', () => {
      console.warn('Клиент: Соединение с сигнальным сервером PeerJS разорвано. Восстановление...');
      const reconnectInterval = setInterval(() => {
        if (newPeer.destroyed) {
          clearInterval(reconnectInterval);
          return;
        }
        if (newPeer.disconnected) {
          newPeer.reconnect();
        } else {
          clearInterval(reconnectInterval);
        }
      }, 5000);
    });

    newPeer.on('error', (err) => {
      console.error(err);
      if (err.type === 'network') {
        console.warn('Клиент: Сетевая ошибка сигнального сервера, пробуем восстановить...');
        if (!newPeer.destroyed && newPeer.disconnected) {
          newPeer.reconnect();
        }
      } else {
        setConnectionStatus('error');
        setErrorMessage(`Не удалось запустить PeerJS клиент: ${err.message}`);
      }
    });

    setPeer(newPeer);
  };

  // HOST HANDLERS
  const handleJoinAction = (conn: DataConnection, name: string) => {
    const fullState = trueGameStateRef.current;
    if (!fullState) return;

    const clientId = conn.peer;
    const existing = fullState.players.find(p => p.id === clientId);

    // Если игра запущена, то зайти могут только переподключающиеся старые игроки
    if (fullState.status !== 'lobby' && !existing) {
      conn.send({ type: 'ERROR', payload: 'Игра уже началась. Вход новым игрокам закрыт.' });
      conn.close();
      return;
    }

    if (fullState.players.length >= 10 && !existing) {
      conn.send({ type: 'ERROR', payload: 'Комната заполнена (макс. 10 игроков)' });
      conn.close();
      return;
    }

    // Обработка успешного реконнекта существующего игрока
    if (existing) {
      existing.active = true;
      existing.name = name; // Обновляем имя в случае изменения
      connectionsRef.current[clientId] = conn;

      let updatedState = addLog(fullState, `Игрок ${name} вернулся в игру!`, 'success');
      broadcastState(updatedState);
      return;
    }

    // Add new player (only in lobby)
    const newPlayer: Player = {
      id: clientId,
      name,
      isHost: false,
      role: null,
      brokenTools: [],
      hand: [],
      handSize: 0,
      score: 0,
      active: true,
    };

    connectionsRef.current[clientId] = conn;

    let updatedState = {
      ...fullState,
      players: [...fullState.players, newPlayer],
    };

    updatedState = addLog(updatedState, `Игрок ${name} присоединился к игре`, 'info');
    broadcastState(updatedState);
  };

  const handlePlayerDisconnect = (peerId: string) => {
    const fullState = trueGameStateRef.current;
    if (!fullState) return;

    // Find the player ID using peerId
    let player = fullState.players.find(p => p.id === peerId);
    if (!player) {
      // Find inside connection dictionary
      const matchingEntry = Object.entries(connectionsRef.current).find(([_, conn]) => (conn as any).peer === peerId);
      if (matchingEntry) {
        player = fullState.players.find(p => p.id === matchingEntry[0]);
      }
    }

    if (!player) return;

    player.active = false;
    
    // Удаляем неактивную сессию из списка рассылки
    delete connectionsRef.current[player.id];

    let updatedState = addLog(fullState, `Игрок ${player.name} отключился`, 'warning');
    broadcastState(updatedState);
  };

  // Authoritative action processing on Host
  const handleNetworkAction = (senderId: string, action: NetworkAction) => {
    const fullState = trueGameStateRef.current;
    if (!fullState) return;

    // Игнорируем Heartbeat-сообщения от клиентов
    if (action.type === 'PING' as any) {
      return;
    }

    // Host or Client triggers
    let updatedState = { ...fullState };

    const playerIndex = updatedState.players.findIndex(p => p.id === senderId);
    if (playerIndex === -1 && action.type !== 'JOIN') return;
    const player = updatedState.players[playerIndex];

    switch (action.type) {
      case 'START_GAME': {
        if (senderId !== updatedState.hostId) return;
        if (updatedState.players.length < 2) {
          updatedState = addLog(updatedState, 'Для начала игры нужно как минимум 2 игрока!', 'error');
          broadcastState(updatedState);
          return;
        }

        updatedState = startRound(updatedState, 1);
        break;
      }

      case 'PLAY_TUNNEL': {
        if (updatedState.status !== 'playing') return;
        if (updatedState.currentTurn !== playerIndex) return;

        if (player.brokenTools.length > 0) {
          updatedState = addLog(updatedState, `${player.name}: Нельзя играть карту туннеля с поломанным инструментом!`, 'error');
          broadcastState(updatedState);
          return;
        }

        const { cardId, x, y, rotated } = action.payload;
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;
        const card = player.hand[cardIndex] as TunnelCard;

        const validation = validateTunnelPlacement(updatedState.grid, card, x, y, rotated);
        if (!validation.valid) {
          updatedState = addLog(updatedState, `${player.name}: Ошибка хода! ${validation.reason}`, 'error');
          broadcastState(updatedState);
          return;
        }

        const newPlaced: PlacedCard = {
          card,
          rotated,
          x,
          y,
        };

        updatedState.grid[`${x},${y}`] = newPlaced;
        player.hand.splice(cardIndex, 1);
        player.handSize = player.hand.length;

        updatedState = addLog(updatedState, `${player.name} построил туннель на (${x}, ${y})`, 'info');

        if (updatedState.deck.length > 0) {
          const drawn = updatedState.deck.pop()!;
          player.hand.push(drawn);
          player.handSize = player.hand.length;
        }
        updatedState.deckCount = updatedState.deck.length;

        updatedState = checkGoalReveal(updatedState, senderId);

        if (updatedState.status === 'playing') {
          updatedState = nextTurn(updatedState);
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

        if (card.actionType === 'break_tool') {
          if (!targetPlayer || !card.toolType) return;
          if (targetPlayer.brokenTools.includes(card.toolType)) {
            updatedState = addLog(updatedState, `Инструмент уже сломан у ${targetPlayer.name}`, 'error');
            broadcastState(updatedState);
            return;
          }

          targetPlayer.brokenTools.push(card.toolType);
          player.hand.splice(cardIndex, 1);
          player.handSize = player.hand.length;
          updatedState.discardPile.push(card);

          const toolName = card.toolType === 'lamp' ? 'фонарь' : card.toolType === 'cart' ? 'вагонетку' : 'кирку';
          updatedState = addLog(updatedState, `${player.name} сломал ${toolName} игроку ${targetPlayer.name}`, 'warning');

        } else if (card.actionType === 'repair_tool') {
          if (!targetPlayer) return;
          let repairTool: ToolType | undefined;

          if (card.toolType) {
            repairTool = card.toolType;
          } else if (card.repairTypes && toolToRepair) {
            if (card.repairTypes.includes(toolToRepair)) {
              repairTool = toolToRepair;
            }
          }

          if (!repairTool || !targetPlayer.brokenTools.includes(repairTool)) {
            updatedState = addLog(updatedState, `Невозможно починить этот инструмент у ${targetPlayer.name}`, 'error');
            broadcastState(updatedState);
            return;
          }

          targetPlayer.brokenTools = targetPlayer.brokenTools.filter(t => t !== repairTool);
          player.hand.splice(cardIndex, 1);
          player.handSize = player.hand.length;
          updatedState.discardPile.push(card);

          const toolName = repairTool === 'lamp' ? 'фонарь' : repairTool === 'cart' ? 'вагонетку' : 'кирку';
          updatedState = addLog(updatedState, `${player.name} починил ${toolName} игроку ${targetPlayer.name}`, 'success');

        } else if (card.actionType === 'cave_in') {
          if (x === undefined || y === undefined) return;
          const targetCoord = `${x},${y}`;
          const targetPlaced = updatedState.grid[targetCoord];

          if (!targetPlaced || targetPlaced.isEntrance || targetPlaced.isGoal) {
            updatedState = addLog(updatedState, 'Нельзя взорвать эту ячейку', 'error');
            broadcastState(updatedState);
            return;
          }

          delete updatedState.grid[targetCoord];
          player.hand.splice(cardIndex, 1);
          player.handSize = player.hand.length;
          updatedState.discardPile.push(card);

          updatedState = addLog(updatedState, `${player.name} устроил обвал на (${x}, ${y})`, 'warning');

        } else if (card.actionType === 'map') {
          if (x === undefined || y === undefined) return;
          const targetGoal = updatedState.goals.find(g => g.x === x && g.y === y);
          if (!targetGoal || targetGoal.flipped) {
            updatedState = addLog(updatedState, 'Карта цели уже открыта или не существует', 'error');
            broadcastState(updatedState);
            return;
          }

          updatedState.revealedGoals[`${x},${y}_${senderId}`] = true;
          player.hand.splice(cardIndex, 1);
          player.handSize = player.hand.length;
          updatedState.discardPile.push(card);

          updatedState = addLog(updatedState, `${player.name} тайно посмотрел карту цели`, 'info');
        }

        if (updatedState.deck.length > 0) {
          const drawn = updatedState.deck.pop()!;
          player.hand.push(drawn);
          player.handSize = player.hand.length;
        }
        updatedState.deckCount = updatedState.deck.length;

        updatedState = nextTurn(updatedState);
        break;
      }

      case 'DISCARD': {
        if (updatedState.status !== 'playing') return;
        if (updatedState.currentTurn !== playerIndex) return;

        const { cardIds } = action.payload;
        if (!cardIds || cardIds.length === 0) return;

        const validCardIds = cardIds.filter(id => player.hand.some(c => c.id === id));
        if (validCardIds.length === 0) return;

        validCardIds.forEach(id => {
          const cardIndex = player.hand.findIndex(c => c.id === id);
          if (cardIndex !== -1) {
            const discardedCard = player.hand.splice(cardIndex, 1)[0];
            updatedState.discardPile.push(discardedCard);
          }
        });
        player.handSize = player.hand.length;

        updatedState = addLog(updatedState, `${player.name} сбросил карт: ${validCardIds.length}`, 'info');

        for (let i = 0; i < validCardIds.length; i++) {
          if (updatedState.deck.length > 0) {
            const drawn = updatedState.deck.pop()!;
            player.hand.push(drawn);
          }
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

        const validCardIds = cardIds.filter(id => player.hand.some(c => c.id === id));
        if (validCardIds.length !== 2) return;

        validCardIds.forEach(id => {
          const cardIndex = player.hand.findIndex(c => c.id === id);
          if (cardIndex !== -1) {
            const discardedCard = player.hand.splice(cardIndex, 1)[0];
            updatedState.discardPile.push(discardedCard);
          }
        });

        player.brokenTools.splice(toolIdx, 1);
        player.handSize = player.hand.length;

        const toolNameRu = toolToRepair === 'lamp' ? 'Фонарь' : toolToRepair === 'cart' ? 'Вагонетку' : 'Кирку';
        updatedState = addLog(updatedState, `${player.name} сбросил 2 карты и починил свой инструмент: ${toolNameRu}`, 'success');

        if (updatedState.deck.length > 0) {
          const drawn = updatedState.deck.pop()!;
          player.hand.push(drawn);
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

    broadcastState(updatedState);
  };

  // Core start round function
  const startRound = (state: GameState, roundNum: number): GameState => {
    let updated = { ...state };
    updated.status = 'playing';
    updated.round = roundNum;
    updated.discardPile = [];
    updated.revealedGoals = {};
    updated.winnerTeam = undefined;
    updated.roundGoldReward = undefined;

    updated.players.forEach(p => {
      p.brokenTools = [];
      p.hand = [];
      p.handSize = 0;
      p.isWinnerOfRound = false;
    });

    const freshDeck = createFullDeck();
    updated.deck = freshDeck;

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
    let minersCount = 3;

    if (numPlayers === 4) { saboteursCount = 1; minersCount = 4; }
    else if (numPlayers === 5) { saboteursCount = 2; minersCount = 4; }
    else if (numPlayers === 6) { saboteursCount = 2; minersCount = 5; }
    else if (numPlayers === 7) { saboteursCount = 3; minersCount = 5; }
    else if (numPlayers === 8) { saboteursCount = 3; minersCount = 6; }
    else if (numPlayers === 9) { saboteursCount = 3; minersCount = 7; }
    else if (numPlayers >= 10) { saboteursCount = 4; minersCount = 7; }
    else {
      saboteursCount = 1;
      minersCount = 2;
    }

    const roles: ('miner' | 'saboteur')[] = [];
    for (let i = 0; i < saboteursCount; i++) roles.push('saboteur');
    for (let i = 0; i < minersCount; i++) roles.push('miner');

    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    updated.players.forEach((p, idx) => {
      p.role = roles[idx];
    });

    let cardsPerHand = 6;
    if (numPlayers >= 6 && numPlayers <= 7) cardsPerHand = 5;
    else if (numPlayers >= 8) cardsPerHand = 4;

    updated.players.forEach(p => {
      for (let i = 0; i < cardsPerHand; i++) {
        if (updated.deck.length > 0) {
          p.hand.push(updated.deck.pop()!);
        }
      }
      p.handSize = p.hand.length;
    });

    updated.deckCount = updated.deck.length;
    updated.currentTurn = Math.floor(Math.random() * numPlayers);

    updated = addLog(updated, `Раунд ${roundNum} начался! Роли розданы. Ход игрока: ${updated.players[updated.currentTurn].name}`, 'success');

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
        // Goal reached! Reveal it
        const flippedPlaced: PlacedCard = {
          card: g.card,
          rotated: false,
          x: g.x,
          y: g.y,
          isGoal: true,
          flipped: true,
          isGold: g.isGold, // Явно сохраняем флаг золота в ячейку поля
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

  const endRoundWithWinners = (state: GameState, team: 'miners' | 'saboteurs', finisherId?: string): GameState => {
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

      updated = addLog(updated, `Распределение золота для гномов-искателей завершено!`, 'success');
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

      updated = addLog(updated, `Вредители победили в раунде! Каждому вредителю начислено по ${valuePerSab} золота.`, 'warning');
    }

    updated.roundGoldReward = reward;
    return updated;
  };

  // CLIENT SENDER ACTION
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