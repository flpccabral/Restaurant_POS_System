import { api } from "@/lib/api";

interface LoginCredentials {
  email: string;
  password: string;
}

export const authService = {
  login: async (credentials: LoginCredentials) => {
    const response = await api.post("/user/login", credentials);
    return response.data;
  },

  logout: async () => {
    await api.post("/user/logout");
  },

  getUser: async () => {
    const response = await api.get("/user");
    return response.data;
  },
};
