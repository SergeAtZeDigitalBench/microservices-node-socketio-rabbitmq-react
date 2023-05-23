import React from "react";
import withSocket, { ISocketApi } from "./withSocket";
import logo from "./logo.svg";
import "./App.css";

function App({ socketListen, socketSend }: ISocketApi) {
  socketSend && socketSend("message", { name: "i am connected" });
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
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
