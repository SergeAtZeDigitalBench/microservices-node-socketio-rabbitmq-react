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
  // TODO save user to database & anything else you might want to do
  const resData = JSON.parse(event.content.toString());

  LOGGER.debug(`Sending login response`);
  let response = {
    type: "loginResponse",
    res: "User logged in",
    socketId: resData.socketId,
  };
  rabbit.channel.send("frontendMessage", response);
}
