import { useDispatch } from "react-redux";
import { getUserData } from "../https";
import { useEffect, useState } from "react";
import { removeUser, setUser } from "../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";

const useLoadData = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await getUserData();
        const { _id, name, email, phone, role, store, isMasterAdmin } = data.data;
        // Extrair apenas o _id do store (pode vir como objeto populado ou string)
        const storeId = typeof store === 'object' && store !== null ? store._id : store;
        dispatch(setUser({ _id, name, email, phone, role, store: storeId, isMasterAdmin }));
      } catch (error) {
        dispatch(removeUser());
        navigate("/auth");
      }finally{
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [dispatch, navigate]);

  return isLoading;
};

export default useLoadData;
