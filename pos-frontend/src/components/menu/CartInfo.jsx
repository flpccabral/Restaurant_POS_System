import React, { useEffect, useRef, useState } from 'react';
import { FiTrash2, FiEdit3 } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { removeItem, updateItemNotes } from '../../redux/slices/cartSlice';

const CartInfo = () => {
  const cartData = useSelector((state) => state.cart);
  const scrolLRef = useRef();
  const dispatch = useDispatch();
  const [notesOpen, setNotesOpen] = useState(null);
  const [notesText, setNotesText] = useState('');

  useEffect(() => {
    if (scrolLRef.current) {
      scrolLRef.current.scrollTo({
        top: scrolLRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [cartData]);

  const handleRemove = (itemId) => {
    dispatch(removeItem(itemId));
  };

  const handleNotesToggle = (itemId, currentNotes) => {
    if (notesOpen === itemId) {
      setNotesOpen(null);
      setNotesText('');
    } else {
      setNotesOpen(itemId);
      setNotesText(currentNotes || '');
    }
  };

  const handleNotesSave = (itemId) => {
    dispatch(updateItemNotes({ id: itemId, notes: notesText }));
    setNotesOpen(null);
    setNotesText('');
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-3" ref={scrolLRef}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">
          Itens do Pedido
        </h2>
        <span className="text-gray-400 text-xs font-medium">
          {cartData.length} item(ns)
        </span>
      </div>

      <div className="space-y-2">
        {cartData.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-200 text-4xl mb-3">&#9744;</div>
            <p className="text-gray-400 text-sm">
              Carrinho vazio
            </p>
            <p className="text-gray-300 text-xs mt-1">
              Adicione produtos pelo menu ao lado
            </p>
          </div>
        ) : (
          cartData.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm"
            >
              <div className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-gray-900 font-semibold text-sm truncate">
                      {item.quantity}x {item.name}
                    </h3>
                    <p className="text-gray-400 text-xs mt-0.5">
                      Unit. R$ {Number(
                        item.pricePerQuantity || item.price / item.quantity
                      ).toFixed(2)}
                    </p>
                    {item.notes && notesOpen !== item.id && (
                      <p className="text-amber-600 text-[11px] mt-1 italic truncate">
                        Obs: {item.notes}
                      </p>
                    )}
                  </div>
                  <span className="text-gray-900 text-sm font-bold whitespace-nowrap">
                    R$ {item.price.toFixed(2)}
                  </span>
                </div>

                {/* Notes inline input */}
                {notesOpen === item.id && (
                  <div
                    className="mt-2 flex flex-col gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={notesText}
                      onChange={(e) => setNotesText(e.target.value)}
                      placeholder="Ex: ponto da carne, sem cebola..."
                      className="bg-gray-50 text-gray-900 text-sm p-2 rounded border border-gray-200 outline-none focus:border-blue-400 transition-colors"
                      maxLength={300}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleNotesSave(item.id)}
                        className="bg-blue-600 text-white font-semibold text-xs px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => setNotesOpen(null)}
                        className="bg-gray-100 text-gray-500 text-xs px-3 py-1.5 rounded hover:bg-gray-200 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 border-t border-gray-100">
                <button
                  onClick={() => handleRemove(item.id)}
                  className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  <FiTrash2 size={12} />
                  Remover
                </button>
                <button
                  onClick={() => handleNotesToggle(item.id, item.notes)}
                  className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                    notesOpen === item.id || item.notes
                      ? 'text-amber-600 hover:bg-amber-50'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <FiEdit3 size={12} />
                  {item.notes ? 'Editar obs' : 'Observacao'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CartInfo;
