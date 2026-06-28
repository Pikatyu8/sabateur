FROM node:20-alpine

WORKDIR /app

# Копируем только файлы зависимостей для быстрой установки
COPY package*.json ./

# Устанавливаем все зависимости
RUN npm install

# Копируем остальные файлы проекта
COPY . .

# Открываем порт 7860, который ожидает Hugging Face
EXPOSE 7860

# Задаем переменные окружения
ENV PORT=7860
ENV NODE_ENV=production

# Запускаем TypeScript-сервер напрямую с помощью утилиты tsx (ES-совместимой)
CMD ["npx", "--yes", "tsx", "server.ts"]
