import { Routes, Route } from "react-router-dom";
import Home from "./Home.tsx";
import Register from "./Register.tsx";
import Passwords from "./Passwords.tsx";
import Login from "./Login.tsx";

function App() {

  return (
    <>
        <Routes>
            <Route path="/" element={<Home/>} />
            <Route path="/passwords" element={<Passwords/>} />
            <Route path="/register" element={<Register/>} />
            <Route path="/login" element={<Login/>}/>
        </Routes>
    </>
  )
}

export default App
