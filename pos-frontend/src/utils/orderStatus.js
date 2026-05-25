export const ORDER_STATUS_MAP = {
  "In Progress": "Em Preparo",
  "Ready": "Pronto",
  "Completed": "Concluído",
};

export const TABLE_STATUS_MAP = {
  "Available": "Disponível",
  "Booked": "Ocupada",
};

export const translateOrderStatus = (status) => ORDER_STATUS_MAP[status] || status;

export const translateTableStatus = (status) => TABLE_STATUS_MAP[status] || status;
