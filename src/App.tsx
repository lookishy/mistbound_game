import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { Lobby } from './pages/Lobby';
import { Room } from './pages/Room';
import { SoundManager } from './lib/SoundManager';

function App() {
  useEffect(() => {
    // Global listener to initialize sound manager on first click
    const initAudio = () => {
      SoundManager.init();
      document.removeEventListener('click', initAudio);
    };
    document.addEventListener('click', initAudio);
    return () => document.removeEventListener('click', initAudio);
  }, []);

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
