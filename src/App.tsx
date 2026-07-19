import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { Lobby } from './pages/Lobby';
import { Room } from './pages/Room';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/mistbound_game/">
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/room/:roomId" element={<Room />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
