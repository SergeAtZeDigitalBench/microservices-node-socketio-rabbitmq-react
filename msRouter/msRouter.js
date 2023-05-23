const rabbit = require("amqplib/callback_api");
const express = require("express");
const { Server } = require("socket.io");
const http = require("http");
const pino = require("pino");
require("dotenv").config();

const LOGGER = pino({
  level: process.env.LOG_LEVEL || "info",
});
const queues = ["userLogin", "frontendMessage"];

LOGGER.info("Starting server");
const server = http.createServer(express());
const io = new Server(server);

LOGGER.info(`Connecting to RabbitMQ`);
rabbit.connect("amqp://127.0.0.1", (error0, connection) => {
  if (error0) {
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
    const event = JSON.parse(data);
    LOGGER.debug(event);

    event.socketId = socket.id;
    rabbit.channel.send("userLogin", event);
  });
});

server.listen(process.env.INTERNAL_API_PORT);
LOGGER.info(`Server listening on ${process.env.INTERNAL_API_PORT}`);
