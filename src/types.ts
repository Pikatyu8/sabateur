// src/types.ts
export type CardType = 'tunnel' | 'action';

export interface TunnelCard {
  id: string;
  type: 'tunnel';
  name: string;
  exits: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
  connectedParts: ('top' | 'right' | 'bottom' | 'left')[][];
  isLadder?: boolean;
  hasCrystal?: boolean; // Кристаллы для геологов
}

export interface ActionCard {
  id: string;
  type: 'action';
  actionType: 'break_tool' | 'repair_tool' | 'cave_in' | 'map' | 'view_role' | 'swap_roles' | 'swap_cards' | 'tic_tac_toe';
  name: string;
  description: string;
  toolType?: 'lamp' | 'cart' | 'pickaxe'; // Для поломки и простого ремонта
  repairTypes?: ('lamp' | 'cart' | 'pickaxe')[]; // Для двойного ремонта
  tttDuration?: 15 | 30; // Время для дуэли в крестики-нолики
}

export type Card = TunnelCard | ActionCard;

export interface PlacedCard {
  card: TunnelCard;
  rotated: boolean;
  x: number;
  y: number;
  isGoal?: boolean;
  isGold?: boolean;
  isEntrance?: boolean;
  flipped?: boolean; // Открыта ли цель
}

export type ToolType = 'lamp' | 'cart' | 'pickaxe';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  role: 'miner' | 'saboteur' | 'geologist' | null; // Геологи добавлены
  brokenTools: ToolType[];
  hand: Card[];
  handSize: number;
  maxHandSize: number; // Динамический лимит руки
  score: number; // Общий счет в золоте (постоянный)
  goldResources: number; // Расходуемое золото внутри раунда
  isWinnerOfRound?: boolean;
  active: boolean;
}

export type GameStatus = 'lobby' | 'playing' | 'round_end' | 'game_end';

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'chat';
  playerName?: string;
}

// Состояние массового хода
export interface MassActionState {
  active: boolean;
  type: 'double_tunnel' | 'double_cave_in' | 'double_map';
  tunnelsPlaced: number;
  caveInsDone: number;
  mapsViewed: number;
}

// Состояние мини-игры Крестики-Нолики
export interface TTTGameState {
  active: boolean;
  challengerId: string;
  targetId: string;
  board: (string | null)[]; // 9 клеток
  currentTurnId: string;
  timeLimit: number;
  timeLeft: number;
  winnerId?: string | 'draw';
  isSpinningWheel?: boolean;
  wheelWinnerId?: string;
}

export interface GameState {
  roomId: string;
  status: GameStatus;
  round: number; // 1, 2, 3
  players: Player[];
  grid: Record<string, PlacedCard>;
  deckCount: number;
  deck: Card[];
  discardPile: Card[];
  currentTurn: number;
  hostId: string;
  goals: {
    x: number;
    y: number;
    isGold: boolean;
    flipped: boolean;
    card: TunnelCard;
  }[];
  unusedRoles: ('miner' | 'saboteur' | 'geologist')[]; // Пул неиспользуемых ролей
  logs: LogEntry[];
  goldCardCount: number;
  revealedGoals: Record<string, boolean>; // x,y_playerId -> true
  revealedRoles: Record<string, boolean>; // targetPlayerId_viewerPlayerId -> true (просмотренные роли)
  winnerTeam?: 'miners' | 'saboteurs' | 'geologists';
  roundGoldReward?: Record<string, number>;
  massActionState?: MassActionState; // Активное массовое действие
  tttState?: TTTGameState; // Состояние дуэли в крестики-нолики
}

export type NetworkAction =
  | { type: 'JOIN'; payload: { name: string } }
  | { type: 'START_GAME' }
  | { type: 'PLAY_TUNNEL'; payload: { cardId: string; x: number; y: number; rotated: boolean } }
  | { type: 'PLAY_ACTION'; payload: { cardId: string; targetPlayerId?: string; x?: number; y?: number; toolToRepair?: ToolType } }
  | { type: 'DISCARD'; payload: { cardIds: string[] } }
  | { type: 'REPAIR_SELF_WITH_DISCARD'; payload: { cardIds: string[]; toolToRepair: ToolType } }
  | { type: 'SEND_CHAT'; payload: { message: string } }
  | { type: 'NEXT_ROUND' }
  | { type: 'RESTART_GAME' }
  // Новые сетевые действия:
  | { type: 'ACTIVATE_MASS_ACTION'; payload: { type: 'double_tunnel' | 'double_cave_in' | 'double_map'; cardId1?: string; cardId2?: string } }
  | { type: 'CONFIRM_MASS_ACTION' }
  | { type: 'TRANSFORM_CARD'; payload: { cardId: string; targetType: string; cost: number } }
  | { type: 'TTT_MOVE'; payload: { cellIndex: number } };