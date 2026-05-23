import React from "react";
import { MdInbox } from "react-icons/md";

const EmptyState = ({ message = "Nenhum dado encontrado.", icon: Icon = MdInbox }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <Icon className="text-5xl text-[#555] mb-4" />
    <p className="text-[#ababab] text-sm">{message}</p>
  </div>
);

export default EmptyState;
