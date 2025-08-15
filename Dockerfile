# Imagen base
FROM node:20

# Directorio de trabajo
WORKDIR /app

# Copiar dependencias
COPY package*.json ./
RUN npm install

# Copiar el código
COPY . .

# Puerto expuesto
EXPOSE 3000

# Comando por defecto
CMD ["npm", "run", "start:dev"]