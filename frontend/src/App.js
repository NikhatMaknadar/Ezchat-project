import React from "react";
import { Redirect, Route, Switch } from "react-router-dom";
import HomePage from "./Pages/HomePage";
import ChatPage from "./Pages/ChatPage";
import "./App.css";

const App = () => (
  <div className="App">
    <Switch>
      <Route path="/" component={HomePage} exact />
      <Route path="/chats" component={ChatPage} />
      <Redirect to="/" />
    </Switch>
  </div>
);

export default App;
