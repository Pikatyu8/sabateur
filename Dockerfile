FROM node:20-alpine

WORKDIR /app

# Копируем только файлы зависимостей для быстрой установки
COPY package*.json ./

# Устанавливаем все зависимости
RUN npm install

# Копируем остальные файлы проекта
COPY . .

# Открываем порт 3000, который ожидает Hugging Face
EXPOSE 3000

# Задаем переменные окружения
ENV PORT=3000
ENV NODE_ENV=production

# Запускаем TypeScript-сервер напрямую с помощью утилиты tsx (ES-совместимой)
CMD ["npx", "--yes", "tsx", "server.ts"]
