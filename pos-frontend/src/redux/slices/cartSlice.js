import { createSlice } from "@reduxjs/toolkit";

const initialState = [];

const cartSlice = createSlice({
    name : "cart",
    initialState,
    reducers : {
        addItems : (state, action) => {
            state.push(action.payload);
        },

        removeItem: (state, action) => {
            return state.filter(item => item.id != action.payload);
        },

        removeAllItems: (state) => {
            return [];
        },

        // Fase 9.3C: Update item notes
        updateItemNotes: (state, action) => {
            const { id, notes } = action.payload;
            const item = state.find(item => item.id === id);
            if (item) {
                item.notes = notes;
            }
        }
    }
})

export const getTotalPrice = (state) => state.cart.reduce((total, item) => total + item.price, 0);
export const { addItems, removeItem, removeAllItems, updateItemNotes } = cartSlice.actions;
export default cartSlice.reducer;
