import React, { ComponentType } from "react";

import socketIOClient from "socket.io-client";

type SocketListen = (
  queue: any,
  callback: (...args: any[]) => void
) => Promise<void>;
type SocketSend = (queue: any, data: any) => Promise<void>;
export interface ISocketApi {
  socketListen?: SocketListen;
  socketSend?: SocketSend;
}

// link should be in environemnt file!
const socket = socketIOClient(process.env.REACT_APP_SOCKET_URL || "");

const withSocket = <P extends Record<string, any>>(
  WrappedComponent: ComponentType<P>
) => {
  const WithSocket = (props: P & ISocketApi) => {
    // function to subscribe to events
    const socketListen = async (
      queue: any,
      callback: (...args: any[]) => void
    ) => {
      socket.on(queue, (data: any) => {
        callback(data);
      });
    };

    const socketSend = async (queue: any, data: any) => {
      socket.emit(queue, JSON.stringify(data));
    };

    return (
      <WrappedComponent
        {...props}
        socketListen={socketListen}
        socketSend={socketSend}
      />
    );
  };

  return WithSocket;
};

export default withSocket;
