import React, { useState, useRef } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const PdvSearchBar = () => {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/menu?search=${encodeURIComponent(query.trim())}`);
      setQuery('');
      setExpanded(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    if (query) {
      navigate('/menu');
    }
  };

  const handleToggle = () => {
    setExpanded(!expanded);
    setTimeout(() => {
      if (!expanded && inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex items-center">
      {expanded ? (
        <div className="flex items-center bg-white/20 rounded-lg overflow-hidden transition-all duration-200">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto, SKU..."
            className="bg-transparent text-white placeholder-white/70 text-sm px-3 py-1.5 outline-none w-52"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="px-1 text-white/70 hover:text-white"
            >
              <FiX size={16} />
            </button>
          )}
          <button
            type="submit"
            className="px-2 text-white hover:text-white/80"
          >
            <FiSearch size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleToggle}
          className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Buscar produtos"
        >
          <FiSearch size={20} />
        </button>
      )}
    </form>
  );
};

export default PdvSearchBar;
