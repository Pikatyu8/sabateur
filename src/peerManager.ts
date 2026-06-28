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

// Filter state for a specific player to prevent cheating (hiding other roles and hands)
export const filterStateForPlayer = (state: GameState, playerId: string): GameState => {
  const isRoundOver = state.status === 'round_end' || state.status === 'game_end';

  return {
    ...state,
    deck: [], // Clear the actual deck
    players: state.players.map(p => {
      const isMe = p.id === playerId;
      return {
        ...p,
        role: (isMe || isRoundOver) ? p.role : null,
        hand: (isMe || isRoundOver) ? p.hand : [],
      };
    }),
    goals: state.goals.map(g => {
      // Goal is revealed to this player if it was flipped (reached by path),
      // if the round is over, or if this specific player used a map action on it.
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

const getPeerConfig = () => {
  if (typeof window === 'undefined') return undefined;

  const host = window.location.hostname;

  // Если запускается локально или в контейнере AI Studio
  const isLocalOrContainer = 
    host === 'localhost' || 
    host === '127.0.0.1' || 
    host.endsWith('.run.app') ||
    host.includes('web-preview') ||
    host.includes('aistudio');

  if (isLocalOrContainer) {
    const secure = window.location.protocol === 'https:';
    const port = window.location.port ? parseInt(window.location.port, 10) : (secure ? 443 : 80);
    return {
      host,
      port,
      path: '/peerjs',
      secure,
      debug: 2,
    };
  }

  // На GitHub Pages подключаемся к вашему бэкенду на Hugging Face Spaces!
  // ВНИМАНИЕ: Замените "pikatyu8" на ваш юзернейм на Hugging Face, 
  // а "saboteur-backend" на точное имя созданного вами Space.
  return {
    host: 'niksan0011-saboteur-backend.hf.space', 
    port: 443,
    secure: true,
    path: '/peerjs',
    debug: 3, // <-- ИЗМЕНИТЕ НА 3: PeerJS начнет выводить все этапы handshake в консоль браузера!
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' }
      ]
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
      const filtered = filterStateForPlayer(fullState, pId);
      (conn as any).send({ type: 'STATE_UPDATE', payload: filtered });
    });
  };

  // HOST: Initialize Room
  const createRoom = (playerName: string) => {
    setConnectionStatus('connecting');
    const code = generateRoomCode();
    setRoomCode(code);
    setIsHost(true);

    const fullPeerId = `saboteur-room-${code}`;
    const newPeer = new Peer(fullPeerId, getPeerConfig());

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
        // Vertically placed goals at (8, -2), (8, 0), (8, 2)
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

      // Add face-down goals on the grid
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
      // Listen to incoming messages from clients
      conn.on('open', () => {
        // A client connected, wait for JOIN message
      });

      conn.on('data', (data: any) => {
        if (!data || typeof data !== 'object') return;
        const msg = data as { type: string; payload?: any; senderId?: string };

        if (msg.type === 'JOIN') {
          handleJoinAction(conn, msg.payload.name);
        } else if (msg.senderId) {
          // Process network action through server authority
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

    newPeer.on('error', (err) => {
      console.error(err);
      setConnectionStatus('error');
      setErrorMessage(`Ошибка PeerJS: ${err.type === 'unavailable-id' ? 'Код комнаты уже занят' : err.message}`);
    });

    setPeer(newPeer);
  };

  // CLIENT: Join Room
  const joinRoom = (code: string, playerName: string) => {
    setConnectionStatus('connecting');
    setRoomCode(code.toUpperCase());
    setIsHost(false);

    const newPeer = new Peer(getPeerConfig());

    newPeer.on('open', (myPeerId) => {
      setPeerId(myPeerId);
      const conn = newPeer.connect(`saboteur-room-${code.toUpperCase()}`);

      conn.on('open', () => {
        setConnectionStatus('connected');
        myPlayerIdRef.current = myPeerId;

        // Save reference to connection
        connectionsRef.current[`host`] = conn;

        // Send JOIN action
        conn.send({ type: 'JOIN', payload: { name: playerName } });
      });

      conn.on('data', (data: any) => {
        const msg = data as { type: string; payload: any };
        if (msg.type === 'STATE_UPDATE') {
          setGameState(msg.payload as GameState);
        }
      });

      conn.on('close', () => {
        setConnectionStatus('disconnected');
        setErrorMessage('Соединение с хостом закрыто');
        setGameState(null);
      });

      conn.on('error', (err) => {
        setConnectionStatus('error');
        setErrorMessage(`Ошибка соединения: ${err.message}`);
      });
    });

    newPeer.on('error', (err) => {
      console.error(err);
      setConnectionStatus('error');
      setErrorMessage(`Не удалось запустить PeerJS клиент: ${err.message}`);
    });

    setPeer(newPeer);
  };

  // HOST HANDLERS
  const handleJoinAction = (conn: DataConnection, name: string) => {
    const fullState = trueGameStateRef.current;
    if (!fullState) return;

    if (fullState.status !== 'lobby') {
      conn.send({ type: 'ERROR', payload: 'Игра уже началась' });
      conn.close();
      return;
    }

    if (fullState.players.length >= 10) {
      conn.send({ type: 'ERROR', payload: 'Комната заполнена (макс. 10 игроков)' });
      conn.close();
      return;
    }

    const clientId = conn.peer;

    // Check if player already exists
    const existing = fullState.players.find(p => p.id === clientId);
    if (existing) {
      existing.active = true;
      connectionsRef.current[clientId] = conn;
      broadcastState(fullState);
      return;
    }

    // Add new player
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
    let updatedState = addLog(fullState, `Игрок ${player.name} отключился`, 'warning');
    broadcastState(updatedState);
  };

  // Authoritative action processing on Host
  const handleNetworkAction = (senderId: string, action: NetworkAction) => {
    const fullState = trueGameStateRef.current;
    if (!fullState) return;

    // Host or Client triggers
    let updatedState = { ...fullState };

    const playerIndex = updatedState.players.findIndex(p => p.id === senderId);
    if (playerIndex === -1 && action.type !== 'JOIN') return;
    const player = updatedState.players[playerIndex];

    switch (action.type) {
      case 'START_GAME': {
        // Only host can start
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
        // Verify it is this player's turn
        if (updatedState.currentTurn !== playerIndex) return;

        // Verify player is not blocked by broken tools
        if (player.brokenTools.length > 0) {
          updatedState = addLog(updatedState, `${player.name}: Нельзя играть карту туннеля с поломанным инструментом!`, 'error');
          broadcastState(updatedState);
          return;
        }

        const { cardId, x, y, rotated } = action.payload;
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;
        const card = player.hand[cardIndex] as TunnelCard;

        // Validate placement
        const validation = validateTunnelPlacement(updatedState.grid, card, x, y, rotated);
        if (!validation.valid) {
          // Send error log specifically
          updatedState = addLog(updatedState, `${player.name}: Ошибка хода! ${validation.reason}`, 'error');
          broadcastState(updatedState);
          return;
        }

        // Apply placement
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

        // Draw new card
        if (updatedState.deck.length > 0) {
          const drawn = updatedState.deck.pop()!;
          player.hand.push(drawn);
          player.handSize = player.hand.length;
        }
        updatedState.deckCount = updatedState.deck.length;

        // Recalculate reachability and check goals
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

          // Repair tool
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

          // Remove card from grid
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

          // Secretly reveal to sender
          updatedState.revealedGoals[`${x},${y}_${senderId}`] = true;
          player.hand.splice(cardIndex, 1);
          player.handSize = player.hand.length;
          updatedState.discardPile.push(card);

          updatedState = addLog(updatedState, `${player.name} тайно посмотрел карту цели`, 'info');
        }

        // Draw new card
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

        // Ensure all cardIds are in player's hand
        const validCardIds = cardIds.filter(id => player.hand.some(c => c.id === id));
        if (validCardIds.length === 0) return;

        // Discard each
        validCardIds.forEach(id => {
          const cardIndex = player.hand.findIndex(c => c.id === id);
          if (cardIndex !== -1) {
            const discardedCard = player.hand.splice(cardIndex, 1)[0];
            updatedState.discardPile.push(discardedCard);
          }
        });
        player.handSize = player.hand.length;

        updatedState = addLog(updatedState, `${player.name} сбросил карт: ${validCardIds.length}`, 'info');

        // Draw the exact same number of cards back!
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

        // Verify player has the broken tool
        const toolIdx = player.brokenTools.indexOf(toolToRepair);
        if (toolIdx === -1) return;

        // Ensure both cardIds are in player's hand
        const validCardIds = cardIds.filter(id => player.hand.some(c => c.id === id));
        if (validCardIds.length !== 2) return;

        // Discard both cards
        validCardIds.forEach(id => {
          const cardIndex = player.hand.findIndex(c => c.id === id);
          if (cardIndex !== -1) {
            const discardedCard = player.hand.splice(cardIndex, 1)[0];
            updatedState.discardPile.push(discardedCard);
          }
        });

        // Repair tool
        player.brokenTools.splice(toolIdx, 1);
        player.handSize = player.hand.length;

        const toolNameRu = toolToRepair === 'lamp' ? 'Фонарь' : toolToRepair === 'cart' ? 'Вагонетку' : 'Кирку';
        updatedState = addLog(updatedState, `${player.name} сбросил 2 карты и починил свой инструмент: ${toolNameRu}`, 'success');

        // Draw ONLY 1 card back (meaning they permanently lose 1 card in hand, i.e., "с потерей одной карты в руке")
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
        // Reset scores
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

    // Reset player states
    updated.players.forEach(p => {
      p.brokenTools = [];
      p.hand = [];
      p.handSize = 0;
      p.isWinnerOfRound = false;
    });

    // Create and shuffle full deck
    const freshDeck = createFullDeck();
    updated.deck = freshDeck;

    // Set up goal cards face down
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

    // Recreate grid
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

    // Deal roles
    const numPlayers = updated.players.length;
    // Determine card counts
    // 3 players: 1 Saboteur, 3 Miners (1 role is discarded)
    // 4 players: 1 Saboteur, 4 Miners
    // 5 players: 2 Saboteurs, 4 Miners
    // 6 players: 2 Saboteurs, 5 Miners
    // 7 players: 3 Saboteurs, 5 Miners
    // 8 players: 3 Saboteurs, 6 Miners
    // 9 players: 3 Saboteurs, 7 Miners
    // 10 players: 4 Saboteurs, 7 Miners
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
      // 2 players (for quick debug/play)
      saboteursCount = 1;
      minersCount = 2;
    }

    const roles: ('miner' | 'saboteur')[] = [];
    for (let i = 0; i < saboteursCount; i++) roles.push('saboteur');
    for (let i = 0; i < minersCount; i++) roles.push('miner');

    // Shuffle roles
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    // Assign roles
    updated.players.forEach((p, idx) => {
      p.role = roles[idx];
    });

    // Cards per hand
    // 2-5 players: 6 cards each
    // 6-7 players: 5 cards each
    // 8-10 players: 4 cards each
    let cardsPerHand = 6;
    if (numPlayers >= 6 && numPlayers <= 7) cardsPerHand = 5;
    else if (numPlayers >= 8) cardsPerHand = 4;

    // Deal cards
    updated.players.forEach(p => {
      for (let i = 0; i < cardsPerHand; i++) {
        if (updated.deck.length > 0) {
          p.hand.push(updated.deck.pop()!);
        }
      }
      p.handSize = p.hand.length;
    });

    updated.deckCount = updated.deck.length;

    // Randomize first player or clockwise from previous
    updated.currentTurn = Math.floor(Math.random() * numPlayers);

    updated = addLog(updated, `Раунд ${roundNum} начался! Роли розданы. Ход игрока: ${updated.players[updated.currentTurn].name}`, 'success');

    return updated;
  };

  // Move turn forward
  const nextTurn = (state: GameState): GameState => {
    let updated = { ...state };
    const initialTurn = updated.currentTurn;

    // Find next active player with cards
    let tries = 0;
    let nextIdx = (updated.currentTurn + 1) % updated.players.length;

    while (tries < updated.players.length) {
      const nextPlayer = updated.players[nextIdx];
      // Player is active if they have cards or the deck is not empty
      if (nextPlayer.active && (nextPlayer.hand.length > 0 || updated.deck.length > 0)) {
        updated.currentTurn = nextIdx;
        break;
      }
      nextIdx = (nextIdx + 1) % updated.players.length;
      tries++;
    }

    // Check if round is over (no cards left in hands of any active players)
    const allHandsEmpty = updated.players.every(p => !p.active || p.hand.length === 0);
    if (allHandsEmpty && updated.deck.length === 0) {
      // Saboteurs win because gold was not reached!
      updated = endRoundWithWinners(updated, 'saboteurs');
    }

    return updated;
  };

  // Check if any goals are revealed
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
        };
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

  // Handle round completion and rewards
  const endRoundWithWinners = (state: GameState, team: 'miners' | 'saboteurs', finisherId?: string): GameState => {
    let updated = { ...state };
    updated.status = 'round_end';
    updated.winnerTeam = team;

    const reward: Record<string, number> = {};

    if (team === 'miners') {
      // Find all miners
      const miners = updated.players.filter(p => p.role === 'miner');
      miners.forEach(p => p.isWinnerOfRound = true);

      // Distribute nuggets automatically
      // Draw nuggets equal to miner count (each miner gets 1 nugget card, values are randomized between 1, 2, and 3)
      const nuggetVals: number[] = [];
      for (let i = 0; i < miners.length; i++) {
        // Shuffled pool of 1, 2, 3 values
        nuggetVals.push(Math.floor(Math.random() * 3) + 1); // 1, 2, or 3
      }
      nuggetVals.sort((a, b) => b - a); // Descending

      // The miner who connected the path gets first choice (best value card)
      // Others get subsequent cards
      let finisherIndex = miners.findIndex(p => p.id === finisherId);
      if (finisherIndex === -1) finisherIndex = 0; // Fallback

      for (let i = 0; i < miners.length; i++) {
        const minerIdx = (finisherIndex + i) % miners.length;
        const playerObj = miners[minerIdx];
        const val = nuggetVals[i] || 1;
        playerObj.score += val;
        reward[playerObj.id] = val;
      }

      updated = addLog(updated, `Распределение золота для гномов-искателей завершено!`, 'success');
    } else {
      // Saboteurs win!
      const sabs = updated.players.filter(p => p.role === 'saboteur');
      sabs.forEach(p => p.isWinnerOfRound = true);

      // Saboteurs rewards (Page 9):
      // 1 Saboteur: 4 nuggets
      // 2 or 3 Saboteurs: 3 nuggets each
      // 4 Saboteurs: 2 nuggets each
      let valuePerSab = 3;
      if (sabs.length === 1) valuePerSab = 4;
      else if (sabs.length >= 4) valuePerSab = 2;
      else if (sabs.length === 0) valuePerSab = 0; // No sabs in a 3-4 game

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
      // Host executes directly
      handleNetworkAction(myPlayerIdRef.current, action);
    } else {
      // Client sends to host
      const hostConn = connectionsRef.current[`host`];
      if (hostConn) {
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
