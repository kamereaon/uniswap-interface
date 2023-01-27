FROM node:14

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
#COPY package*.json ./
#COPY yarn.lock ./

#RUN yarn install

# Bundle app source
COPY . .

#EXPOSE 3000

#ENV REACT_APP_MAINNET_CHAIN_RPC_URL=http://localhost:5000

#RUN yarn build

# npm start with option to add arguments
CMD yarn serve