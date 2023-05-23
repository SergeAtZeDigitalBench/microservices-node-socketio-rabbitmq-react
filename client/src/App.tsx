import React, { useEffect, useState } from "react";

import withSocket, { ISocketApi } from "./withSocket";
import "./App.css";

function App({ socketListen, socketSend }: ISocketApi) {
  const [status, setStatus] = useState<string>("Conecting...");

  useEffect(() => {
    socketListen!("loginResponse", (response) => {
      setStatus(response);
    });

    socketSend!("message", { name: "i am connected" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>{status}</h1>
      </header>
    </div>
  );
}

export default withSocket(App);
