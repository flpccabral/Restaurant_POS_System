import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    _id: "",
    name: "",
    email : "",
    phone: "",
    role: "",
    rolePermissions: null,
    isMasterAdmin: false,
    store: null,
    isAuth: false
}

const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        setUser: (state, action) => {
            const { _id, name, phone, email, role, store, isMasterAdmin } = action.payload;
            state._id = _id;
            state.name = name;
            state.phone = phone;
            state.email = email;
            state.store = store || null;
            state.isMasterAdmin = isMasterAdmin || false;
            state.isAuth = true;

            // role can be a string (legacy 'Admin') or an Object (populated Role document)
            if (typeof role === 'object' && role !== null) {
                state.role = role.name || role.roleId || '';
                state.rolePermissions = role.permissions || null;
            } else {
                state.role = role || '';
                state.rolePermissions = null;
            }
        },

        removeUser: (state) => {
            state._id = "";
            state.email = "";
            state.name = "";
            state.phone = "";
            state.role = "";
            state.rolePermissions = null;
            state.isMasterAdmin = false;
            state.store = null;
            state.isAuth = false;
        }
    }
})

export const { setUser, removeUser } = userSlice.actions;
export default userSlice.reducer;