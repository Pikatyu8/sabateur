# Используем LTS-версию Node.js
FROM node:20-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файлы манифестов зависимостей
COPY package*.json ./

# Устанавливаем все зависимости (включая devDependencies для esbuild и typescript)
RUN npm ci

# Копируем исходный код проекта
COPY . .

# Собираем фронтенд через vite и компилируем бэкенд в dist/server.cjs через esbuild
RUN npm run build

# Hugging Face запускает контейнер от имени не-root пользователя с UID 1000
# Даем права доступа на папку dist, если сервер будет туда что-то писать (например, кэш)
RUN chmod -R 777 /app

# Переменная PORT по умолчанию (HF переопределит её на 7860)
ENV PORT=7860
EXPOSE 7860

# Запуск собранного CJS-сервера
CMD ["npm", "start"]
