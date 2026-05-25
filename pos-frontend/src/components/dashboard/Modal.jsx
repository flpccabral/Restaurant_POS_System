import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import { useMutation } from '@tanstack/react-query';
import { addTable } from '../../https';
import { enqueueSnackbar } from 'notistack';

const Modal = ({ setIsTableModalOpen }) => {
  const [tableData, setTableData] = useState({
    tableNo: '',
    seats: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTableData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    tableMutation.mutate(tableData);
  };

  const handleCloseModal = () => {
    setIsTableModalOpen(false);
  };

  const tableMutation = useMutation({
    mutationFn: (reqData) => addTable(reqData),
    onSuccess: (res) => {
      setIsTableModalOpen(false);
      const { data } = res;
      enqueueSnackbar(data.message, { variant: 'success' });
    },
    onError: (error) => {
      const { data } = error.response;
      enqueueSnackbar(data.message, { variant: 'error' });
    },
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="bg-white p-6 rounded-xl shadow-xl w-96 border border-gray-200"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-gray-900 text-xl font-bold">Adicionar Mesa</h2>
          <button
            onClick={handleCloseModal}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div>
            <label className="block text-gray-500 mb-1 text-sm font-medium">
              Numero da Mesa
            </label>
            <input
              type="number"
              name="tableNo"
              value={tableData.tableNo}
              onChange={handleInputChange}
              className="bg-gray-50 border border-gray-200 text-gray-900 p-3 rounded-lg w-full outline-none focus:border-blue-400 transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-gray-500 mb-1 text-sm font-medium">
              Numero de Lugares
            </label>
            <input
              type="number"
              name="seats"
              value={tableData.seats}
              onChange={handleInputChange}
              className="bg-gray-50 border border-gray-200 text-gray-900 p-3 rounded-lg w-full outline-none focus:border-blue-400 transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg mt-6 py-3 text-base bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors"
          >
            Adicionar Mesa
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default Modal;
