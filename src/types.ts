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
  hasCrystal?: boolean;
}

export interface ActionCard {
  id: string;
  type: 'action';
  actionType: 'break_tool' | 'repair_tool' | 'cave_in' | 'map';
  name: string;
  description: string;
  toolType?: 'lamp' | 'cart' | 'pickaxe'; // For break_tool and simple repair_tool
  repairTypes?: ('lamp' | 'cart' | 'pickaxe')[]; // For multi repair_tool
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
  flipped?: boolean; // For goals: true means revealed
}

export type ToolType = 'lamp' | 'cart' | 'pickaxe';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  role: 'miner' | 'saboteur' | null; // Null in lobby or hidden for other players
  brokenTools: ToolType[];
  hand: Card[]; // Hidden from other players in filtered state
  handSize: number; // Disclosed to other players
  score: number; // Gold nuggets
  isWinnerOfRound?: boolean;
  active: boolean; // Connection status
}

export type GameStatus = 'lobby' | 'playing' | 'round_end' | 'game_end';

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'chat';
  playerName?: string;
}

export interface GameState {
  roomId: string;
  status: GameStatus;
  round: number; // 1, 2, or 3
  players: Player[];
  grid: Record<string, PlacedCard>; // key: "x,y"
  deckCount: number;
  deck: Card[]; // Secret, kept by host
  discardPile: Card[];
  currentTurn: number; // index of player in players array
  hostId: string;
  goals: {
    x: number;
    y: number;
    isGold: boolean;
    flipped: boolean;
    card: TunnelCard;
  }[];
  logs: LogEntry[];
  goldCardCount: number; // Remainder of gold cards
  revealedGoals: Record<string, boolean>; // map of x,y -> true if current player knows it
  winnerTeam?: 'miners' | 'saboteurs';
  roundGoldReward?: Record<string, number>; // player ID -> gold reward
}

// Actions that can be sent from client to host
export type NetworkAction =
  | { type: 'JOIN'; payload: { name: string } }
  | { type: 'START_GAME' }
  | { type: 'PLAY_TUNNEL'; payload: { cardId: string; x: number; y: number; rotated: boolean } }
  | { type: 'PLAY_ACTION'; payload: { cardId: string; targetPlayerId?: string; x?: number; y?: number; toolToRepair?: ToolType } }
  | { type: 'DISCARD'; payload: { cardIds: string[] } }
  | { type: 'REPAIR_SELF_WITH_DISCARD'; payload: { cardIds: string[]; toolToRepair: ToolType } }
  | { type: 'SEND_CHAT'; payload: { message: string } }
  | { type: 'NEXT_ROUND' }
  | { type: 'RESTART_GAME' };
