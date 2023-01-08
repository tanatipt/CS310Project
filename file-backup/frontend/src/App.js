import logo from "./logo.svg";
import "./App.css";
import SearchBar from "./pages/SearchBar";
import Collection from "./pages/Collection";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";

function App() {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/collection/:id" element={<Collection />} />
          <Route path="/" element={<SearchBar />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
