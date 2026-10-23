import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { getUsername, setUsername } from '../username.js';

export default function Navbar() {
  const [dark, setDark] = useState(false);
  const [name, setName] = useState(getUsername());

  return (
    <nav className={`navbar ${dark ? 'dark' : ''}`}>
      <Link to="/" className="brand">
        Code<span>Arena</span>
      </Link>
      <NavLink to="/">Problems</NavLink>
      <NavLink to="/leaderboard">Leaderboard</NavLink>
      <div className="spacer" />
      <input
        className="username"
        placeholder="Your team name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setUsername(e.target.value);
        }}
      />
      <button className="ghost" onClick={() => setDark(!dark)} title="Toggle dark mode">
        {dark ? '☀️' : '🌙'}
      </button>
    </nav>
  );
}
