import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    orderId: "",
    customerName: "",
    customerPhone: "",
    guests: 0,
    table: null,
    orderType: "dine_in" // Fase 9.3C: dine_in, counter, pickup, delivery
}


const customerSlice = createSlice({
    name : "customer",
    initialState,
    reducers : {
        setCustomer: (state, action) => {
            const { name, phone, guests } = action.payload;
            state.orderId = `${Date.now()}`;
            state.customerName = name;
            state.customerPhone = phone;
            state.guests = guests;
        },

        removeCustomer: (state) => {
            state.customerName = "";
            state.customerPhone = "";
            state.guests = 0;
            state.table = null;
            state.orderType = "dine_in";
        },

        updateTable: (state, action) => {
            state.table = action.payload.table;
        },

        setOrderType: (state, action) => {
            state.orderType = action.payload;
        }

    }
})


export const { setCustomer, removeCustomer, updateTable, setOrderType } = customerSlice.actions;
export default customerSlice.reducer;
