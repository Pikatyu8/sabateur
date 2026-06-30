// src/ticTacToeEngine.ts
export const checkTTTWinner = (board: (string | null)[]): string | null => {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Строки
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Столбцы
    [0, 4, 8], [2, 4, 6]             // Диагонали
  ];
  for (const line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // Возвращает 'X' или 'O'
    }
  }
  return null;
};

export const isTTTBoardFull = (board: (string | null)[]): boolean => {
  return board.every(cell => cell !== null);
};