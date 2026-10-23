import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProblemList from './pages/ProblemList.jsx';
import ProblemPage from './pages/ProblemPage.jsx';
import Leaderboard from './pages/Leaderboard.jsx';

export default function App() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<ProblemList />} />
          <Route path="/problems/:slug" element={<ProblemPage />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </main>
    </>
  );
}
