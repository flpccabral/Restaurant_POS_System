export const ORDER_STATUS_MAP = {
  "In Progress": "Em Preparo",
  "Ready": "Pronto",
  "done": "Pronto",
  "completed": "Concluído",
  "Completed": "Concluído",
  "paid": "Pago",
  "cancelled": "Cancelado",
  "Cancelled": "Cancelado",
};

export const TABLE_STATUS_MAP = {
  "Available": "Disponível",
  "Booked": "Ocupada",
};

export const translateOrderStatus = (status) => ORDER_STATUS_MAP[status] || status;

export const translateTableStatus = (status) => TABLE_STATUS_MAP[status] || status;
