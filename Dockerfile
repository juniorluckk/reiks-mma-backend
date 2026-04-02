FROM node:18-alpine

WORKDIR /app

# Copia apenas o package.json primeiro para otimizar o cache
COPY package*.json ./

# Instala as dependências
RUN npm install --production

# Copia o resto do código
COPY . .

# Expõe a porta que vamos usar
EXPOSE 3000

# Comando para iniciar
CMD ["npm", "start"]
