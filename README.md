article: https://medium.com/@the.park/node-js-event-driven-microservice-architecture-using-rabbitmq-socket-io-and-react-frontend-6aa803658a22

## Event driven microservices Node.js, Socket.io, RabbitMQ and React frontend
In this guide i’ll walk you through the basic environment and communication configuration that you’ll need to build an event-driven microservice architecture. In the end, it would look something like this:

![microservices.io](./microservices.webp)

Except we wont be using rest apis between our services, but events. For now, we’re just going to start with the basic three services which you’ll need in most projects: FRONTEND — ROUTER (API) — USER SERVICE.

1. (Step 1) Setting up the environment
2. (Step 2) Creating the server
3. (Step 3) Connecting our Frontend
4. (Step 4) RabbitMQ and msUser
- Discussion
- References

### Setting up the environment

```
yarn create react-app client
cd client
yarn start
```
Next, we will need a router service that our react app will communicate with and a user service, that will deal with all user related stuff. So lets make two more directories in the root folder of your project.

```
// if you're not at root yet
cd ..
mkdir msRouter
mkdir msUser
```
Now lets initialise them by creating a main js file in each directory and running `yarn init`

```
// do this for msUser as well
cd msRouter
touch msRouter.js
yarn init
```

Now we have to add a few basic node packages that will improve our quality of work. (The following part is a compressed version of https://www.robinwieruch.de/minimal-node-js-babel-setup, please refer to this guide for more in depth information)

```
// this will automatically rerun our script whenever when change the // source
npm install nodemon 
// this lets us use ECMAS (the fancy imports and stuff)
npm install @babel/core @babel/node
npm install @babel/preset-env
touch .babelrc
// this lets us work with .env files 
npm install dotenv
touch .env
// logger that we'll use
npm install pino 
// One line for the lazy :) 
npm install nodemon @babel/core @babel/node @babel/preset-env dotenv pino
```

All the installed packages need a little bit of configuration. Notice that we created a .babelrc file. Open it and put this inside

```json
{
    "presets": [
    "@babel/preset-env"
    ]
}
```

Then open your package.json and add a start command to the scripts part. If you ran all of the commands above, your package.json should look something like this (line 7 is where we added the start script):

````json
{
  "name": "msrouter",
  "version": "1.0.0",
  "description": "",
  "main": "msRouter.js",
  "scripts": {
    "start": "nodemon --exec babel-node msRouter.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@babel/core": "^7.9.6",
    "@babel/node": "^7.8.7",
    "@babel/preset-env": "^7.9.6",
    "dotenv": "^8.2.0",
    "nodemon": "^2.0.4",
    "pino": "^6.2.1"
  }
}
````
Now we can actually start writing some code. We’ll need to install a couple more things along the way (rabbitmq, socketio but we’ll do those as we get to them). Your project structure altogether should look something like this:

![folders structure](./folders_structure.webp)

### Creating the server
Lets start by creating the server. Go to the msRouter directory and install a couple more things…

```
yarn add express socket.io
```
We’re going to need these two to start the server and listen to incoming socket messages.

Then we’ll open our msRouter.js and cook up something like this:

````js
const express = require("express");
const socketIO = require("socket.io");
const http = require("http");
const pino = require("pino");
require("dotenv").config();

const LOGGER = pino({
  level: process.env.LOG_LEVEL || "info",
});

LOGGER.info("Starting server");
const server = http.createServer(express());
const io = socketIO(server);

// allow all cors stuff
// io.origins("*:*");

io.on("connection", (socket) => {
  LOGGER.debug(`New user connected ${socket.id}`);

  socket.on("message", (data) => {
    let event = JSON.parse(data);
    LOGGER.debug(event);
  });
});

server.listen(process.env.INTERNAL_API_PORT);
LOGGER.info(`Server listening on ${process.env.INTERNAL_API_PORT}`);

````
Let’s take a quick look at what we did here. Lines 1–6, pretty standard import stuff. Then in line 8 we initialise the LOGGER… although the LOGGER isn’t crucial to the project, the point of this guid is to setup all of the little stuff you’ll need for a project of any size. The bigger you get, the more ridiculous it is to use console.log and the more time you’ll need to implement a proper logger. So let’s just do it now. This way you can use LOGGER.debug anywhere you want and then toggle it with the log level. If you’re going to build a big thing, doing this from the start will make life a little bit easier later on. (more info https://github.com/pinojs/pino).

The rest of the code is opening the socket, straight from the docs — https://www.npmjs.com/package/socket.io. We open it with express so we have those smooth http request options, in case we want to open some REST endpoints in the future. (https://expressjs.com/en/starter/hello-world.html)

Notice that the port to listen on and log level are both taken from the environment, which means you have to actually add them to the .env file:

```
LOG_LEVEL=debug
INTERNAL_API_PORT=3001
```

### Connecting our frontend

Now we need to connect our frontend with our server. Navigate to the client/ directory and install socket.io-client

```
yarn add socket.io-client
```

````js
const socket = socketIOClient(process.env.REACT_APP_SOCKET_URL)
````
That’s all thats needed to connect to our server. You have to put the REACT_APP_SOCKET_URL into your .env file in the client/ directory

```
REACT_APP_SOCKET_URL="http://localhost:3001"
```

Although initialising the socket is a one liner, it’s not all there is to it. The problem we have right now is that this socket is not globally accessible throughout our react app — we can’t “get” to ti in all of our react components. We could always initialise it, but that would create a new socket each time which would make it incredibly hard to track a users session on our backend. What we have to do is open the socket once when the user lands on our page and then have it globally accessible to all of our react components.

There are a few different ways of doing this and I’m not sure which way is the best. Right now, since this guide isn’t frontend focused, we’ll create a Component Wrapper that adds the socket to every component we wrap it around.

Lets move to the frontend/src directory and create a new file called `“withSocket.jsx”` that will initiate the socket and “wrap it around other components”

````jsx
import React from "react"
import socketIOClient from "socket.io-client";

// link should be in environemnt file!
const socket = socketIOClient(process.env.REACT_APP_SOCKET_URL)

// component wrapper that allows us to use socket globaly
function withSocket (WrappedComponent) { 
  const WithSocket = props => {

    // function to subscribe to events
    const socketListen = async (queue, callback) => {
      socket.on(queue, data => {
        callback(data)
      })
    }

    const socketSend = async(queue, data) => {
      socket.emit(queue, JSON.stringify(data))
    }

    return (
      <WrappedComponent
        {...props}
        socketSend={socketSend}
        socketListen={socketListen}
      />
    )
  }
  return WithSocket
}

export default withSocket
````

The 5th line opens the socket, and then we create a function that takes 1 parameter — a component which this function wraps around. In this function, two more functions are defined — socketListen, so we can subscribe components to certain queues / events, and socketSend, to send data to any queue from any component. Then (line 23) we see that the return of this function is actually the component it was given as its parameter, but it injects it with our two new functions so they’re readily available in the props of the wrapped component!

Lets put our socket wrapper to work on the frontend we have — App.js. App.js is the entry point of our frontend and we can wrap the wtihSocket around it and use socketSend as soon as the page loads to send something to our server! (lines 3, 8 and 30 are the only changes from the npx generated file). In line 8 we call socketSend and send an object to the “message” queue on our server — notice that in msRouter.js on line 20 we specifically wrote the handling of “message” events. If we chose to wrote anything else there, then this message sent in line 8 of frontend would not trigger the specified function. This is how you handle different events from different components in different ways, and in a little bit you will learn to send them to different microservices!

````jsx
import React from 'react';
import logo from './logo.svg';
import withSocket from "./withSocket"
import './App.css';

function App({socketListen, socketSend}) {

  socketSend("message", {name: "i am connected"})

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default withSocket(App);
````
Having done all of this, if you start up your server (npm run start in msRouter directory) and your frontend (npm start in frontend directory), your server should log “New user connected {socketid}” and “i am connected” every time you refresh the frontend page!

### RabbitMQ and msUser

Onwards and upwards, a whole new service awaits!

MsUser will handle all user data, store it into a database and share it with other services that might need it (eventually). If you’re asking yourself “why don’t i just write the code in the msRouter directory and use it there?” then you should google around and learn more about microservices and decide if it’s even something you want and/or need to get into (quick example https://www.cio.com/article/3201193/7-reasons-to-switch-to-microservices-and-5-reasons-you-might-not-succeed.html)

There’s really not much we can actually do in the msUser.js file, before we setup and learn to use a communication channel for microservices. For this we will use RabbitMQ. RabbitMQ is an easy to implement (and use) message broker and it “works” in a very similar way as the socket we use for frontend communication — we’ve got queues, events, and in this case event producers and event consumers.
https://www.rabbitmq.com/install-homebrew.html

To install it simply run

```
brew update
brew install rabbitmq
```

We will also need the npm package that allows us to connect and work with RabbitMQ:
```
cd msUser/
yarn add amqplib
```

Now we can open up msUser.js and start cooking. Lets imagine, for now, that our frontend has a login screen. When a user logs in, a “userLoggedIn” event is sent to the router. We want the router to send this event (via RabbitMQ) to msUser and for msUser to respond with an event of its own (like login successful / unsuccessful…). This means that we have to connect both services to rabbit and create a “userLogin” queue (msRouter -> msUser) and a “frontendMessage” queue (msUser -> msRouter). In the case of “userLogin” queue, the msRouter will be the producer of events and msUser the consumer, and the other way around for “frontendMessage” queue. MsUser should look something like this:

````js
const rabbit = require('amqplib/callback_api');
const pino = require('pino');
require('dotenv').config();
const LOGGER = pino({ level: process.env.LOG_LEVEL || 'info' });


LOGGER.info(`Connecting to RabbitMQ`)
rabbit.connect('amqp://127.0.0.1', (error0, connection) => {
    if (error0) {
        throw error0;
    }
    LOGGER.info("Creating default channel on default exchange")
    connection.createChannel((error, channel) => {
        if (error) {
            throw error;
        }
        rabbit.channel = channel

        channel.assertQueue("userLogin", {
            durable: false
        })
        
        channel.assertQueue("frontendMessage", {
            durable: false
        })
        
        channel.send = (queue, message) => {
            channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)))
        }

        LOGGER.info("Attaching consumers...")
        channel.consume("userLogin", (event) => {
            console.log(JSON.parse(event.content.toString()))
        }, {
            noAck: true
        })

        LOGGER.info("All consumers ready")
    })
});
````
We connect to the rabbitmq server and create the channels and consumer, very much like in their official guide https://www.rabbitmq.com/tutorials/tutorial-one-javascript.html.

We create queues “userLogin” (19–21) and “frontendMessage” (23–25), and a consumer for “userLogin” (32–36). We also add a custom channel.send method which converts our JSONs to buffers, so we don’t have to do it manually all the time (27–29).

Please note that there are a lot of possible and extremely useful configurations for RabbitMQ, queues aren’t event the “top level” transport level — exchanges are even higher, but if we don’t specify an exchange, the default exchange is used, so we don’t need to get into them right now. If you want to know more about RabbitMQ they have excellent docs, and you should look into them when you need / want more control.

Time to connect msRouter to rabbit. Open it up and add almost the exact same code as we used in msUser. (Don’t forget we have to run npm install amqplib here as well)

````js
const express = require("express")
const socketIO = require('socket.io');
const http = require('http')
var rabbit = require('amqplib/callback_api');

const pino = require('pino');
require('dotenv').config();

const LOGGER = pino({ level: process.env.LOG_LEVEL || 'info' });

LOGGER.info("Starting server")
let server = http.createServer(express()) 
let io = socketIO(server) 


LOGGER.info(`Connecting to RabbitMQ`)
rabbit.connect('amqp://127.0.0.1', (error0, connection) => {
    if (error0) {
        throw error0;
    }
    LOGGER.info("Creating default channel on default exchange")
    connection.createChannel((error, channel) => {
        if (error) {
            throw error;
        }
        rabbit.channel = channel

        channel.assertQueue("userLogin", {
            durable: false
        })

        channel.assertQueue("frontendMessage", {
            durable: false
        })
        
        channel.send = (queue, message) => {
            channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)))
        }

        LOGGER.info("Attaching consumers...")
        channel.consume("frontendMessage", (event) => {
            console.log(JSON.parse(event.content.toString()))
        }, {
            noAck: true
        })

        LOGGER.info("All consumers ready")
    })
});


// allow all cors stuff
// io.origins('*:*')

io.on('connection', (socket)=>{
    LOGGER.debug(`New user connected ${socket.id}`)

    socket.on("message", (data) => {
        let event = JSON.parse(data)
        LOGGER.debug(event)
        rabbit.channel.send("userLogin", event)
        
    })
});

server.listen(process.env.INTERNAL_API_PORT)
````
We did almost the same thing as we did in msUser service, and we’ll be repeating this chunk of code throughout our microservices, changing the channel.consume and assertQueues methods. This is pointing towards the need for optimisation so we don’t have redundant code all over our workspace — we’ll do that in a later guide.

For now, we open up the connection in msRouter in the same way, and assert the queues (create them in case they don’t exist). The key difference here is that msRouter consumes the “frontendMessage” (line 41) and produces the “userLogin” event (line 61).

If you run all of these three services now, you should be getting the event through to msUser! Now all we have to do is add a response from msUser to msRouter and forward it through the socket to our frontend!

Because this is a login message, we have to send the response to a specific user and not broadcast it to all connected sockets. We will do this by attaching the sending clients ID to our login event, before forwarding it to msUser. We add this in lines 58–62 of msRouter so the on message looks like this:

`msRouter.js`
````js
io.on('connection', (socket)=>{
    LOGGER.debug(`New user connected ${socket.id}`)

    socket.on("message", (data) => {
        let event = JSON.parse(data)
        LOGGER.debug(event)
        event.socketId = socket.id        
        rabbit.channel.send("userLogin", event)
    })
});
````

Now lets add a response in msUser:

````js
const rabbit = require("amqplib/callback_api");
const pino = require("pino");
require("dotenv").config();

const LOGGER = pino({ level: process.env.LOG_LEVEL || "info" });
const queues = ["userLogin", "frontendMessage"];

LOGGER.info(`Connecting to RabbitMQ`);

rabbit.connect("amqp://127.0.0.1", (error0, connection) => {
  if (!!error0) {
    throw error0;
  }

  LOGGER.info("Creating default channel on default exchange");
  connection.createChannel((error, channel) => {
    if (!!error) {
      throw error;
    }

    rabbit.channel = channel;

    queues.forEach((queue) => {
      channel.assertQueue(queue, {
        durable: false,
      });
      LOGGER.info(`Created ${queue} on channel`);
    });

    channel.send = (queue, message) => {
      channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
    };

    LOGGER.info("Attaching consumers...");

    channel.consume("userLogin", onUserLogin, {
      noAck: true,
    });

    LOGGER.info("All consumers ready");
  });
});

async function onUserLogin(event) {
  LOGGER.debug(event);
  const resData = JSON.parse(event.content.toString());

  // TODO save user to database & anything else you might want to do

  LOGGER.debug(`Sending login response`);
  let response = {
    type: "loginResponse",
    res: "User logged in",
    socketId: resData.socketId,
  };
  rabbit.channel.send("frontendMessage", response);
}

````

In this case we didn’t want to write too much code inside the rabbit configuration section, so we parsed and passed the event to a handler function (line 36). We left a TODO in there for everything we actually want to do with the data that the user logs in with. Then we returned a response that is meant to go to our frontend — but everything that comes and goes to frontend has to go through router, so we send it to the “frontendmessage” (line 57) queue to msRouter, and as it’s type we set the name of the queue the actual frontend socket client will listen to (line 53).

We also removed the queue assertion around a little bit — we moved all queue names into a list at the top of the file (line 7) and then we initiate them with a for loop (lines 34–39). This saves us some time and gives us a common place in each microservice where we can quickly add and see all it’s queues. We’ll do the same in msRouter, and add the forward to frontend part (lines 10 & 46–49):

`msRouter.js`

````js
const rabbit = require("amqplib/callback_api");
const express = require("express");
const socketIO = require("socket.io");
const http = require("http");
const pino = require("pino");
require("dotenv").config();

const LOGGER = pino({
  level: process.env.LOG_LEVEL || "info",
});
const queues = ["userLogin", "frontendMessage"];

LOGGER.info("Starting server");
const server = http.createServer(express());
const io = socketIO(server, {
  cors: {
    origin: "*",
  },
});

LOGGER.info(`Connecting to RabbitMQ`);
rabbit.connect("amqp://127.0.0.1", (error0, connection) => {
  if (error0) {
    console.log(error0.toString());
    throw error0;
  }

  LOGGER.info("Creating default channel on default exchange");
  connection.createChannel((error, channel) => {
    if (error) {
      throw error;
    }
    rabbit.channel = channel;

    queues.forEach((currentQueue) => {
      channel.assertQueue(currentQueue, {
        durable: false,
      });
    });

    channel.send = (queue, message) => {
      channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
    };

    LOGGER.info("Attaching consumers...");
    channel.consume(
      "frontendMessage",
      (event) => {
        const resData = JSON.parse(event.content.toString());
        LOGGER.debug(resData);
        io.to(resData.socketId).emit(resData.type, resData.res);
      },
      {
        noAck: true,
      }
    );

    LOGGER.info("All consumers ready");
  });
});

io.on("connection", (socket) => {
  LOGGER.debug(`New user connected ${socket.id}`);

  socket.on("message", (data) => {
    let event = JSON.parse(data);
    LOGGER.debug(event);

    event.socketId = socket.id;
    rabbit.channel.send("userLogin", event);
  });
});

server.listen(process.env.INTERNAL_API_PORT);
LOGGER.info(`Server listening on ${process.env.INTERNAL_API_PORT}`);

````
And lastly, we have to listen for the login response on our frontend — we have to listen on the queue that we set as the response objects type. You can see that in msRouter we forward the response to the socket.io queue equal to the type that we set in the response object (line 49). So in our client/, in this case, we have to listen to “loginResponse”:

````jsx
import React from 'react';
import logo from './logo.svg';
import withSocket from "./withSocket"
import './App.css';

function App({socketListen, socketSend}) {

  socketListen("loginResponse", (response) => {
    console.log(response)
  })

  socketSend("message", {name: "i am connected"})

  

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default withSocket(App);
````
### Discussion
The important thing to note, I think, is how the queue system works compared to REST and that there are 2 different channels of communication to manage — the router-frontend and the “backend-backend”. SocketSend and SocketListen on front end are our new request / response pair — most of our socketSend(queue, data) will have a corresponding socketListen(responseQueue, data) where we catch the response event. In our case this pair is represented as “message” — “loginResponse” (which would make more sense if we set it up as “login” — “loginResponse”). In our backend, all frontend requests are redirected to the appropriate service (msUser for now, but there will be many more), and we want all of our services to be able to send responses to frontend. This is why we opened a “frontendmessage” queue and in the responding event sent by any microservice we added the “type” field to the response — this type field determines the frontend socket queue the message should be sent to! In the picture below, the data.type field is set in msUser, before sending the event to msRouter “frontendmessage” queue.

![dataflow](./communication_flow_daigram.png)