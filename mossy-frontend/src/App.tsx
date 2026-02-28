import { Routes, Route } from "react-router-dom";
import Home from "./Home.tsx";
import Register from "./Register.tsx";
import Passwords from "./Passwords.tsx";
import Login from "./Login.tsx";
import Layout from "./Layout.tsx";

function App() {

  return (
    <>
        <Routes>
            <Route element={<Layout/>}>
                <Route path="/" element={<Home/>} />
                <Route path="/passwords" element={<Passwords/>} />
                <Route path="/register" element={<Register/>} />
                <Route path="/login" element={<Login/>}/>
            </Route>
        </Routes>
    </>
  )
}

export default App
