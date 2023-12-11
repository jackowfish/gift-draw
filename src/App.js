import logo from "./logo.svg";
import "./App.css";
import GiftDraw from "./GiftDraw";

function App() {
  return (
    <div className="App">
      <img src={logo} className="App-logo" alt="logo" />
      <GiftDraw />
    </div>
  );
}

export default App;
