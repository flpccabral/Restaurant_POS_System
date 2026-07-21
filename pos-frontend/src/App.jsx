import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { Home, Auth, Orders, Tables, Menu, Dashboard, TableBill, Kitchen, Commissions } from "./pages";
import Header from "./components/shared/Header";
import { useSelector } from "react-redux";
import useLoadData from "./hooks/useLoadData";
import FullScreenLoader from "./components/shared/FullScreenLoader"

function Layout() {
  const isLoading = useLoadData();
  const location = useLocation();
  // Esconder header em rotas fullscreen (auth e KDS/cozinha)
  const hideHeaderRoutes = ["/auth", "/kitchen"];
  const { isAuth } = useSelector(state => state.user);

  if(isLoading) return <FullScreenLoader />

  // Rota /kitchen tem layout proprio (fullscreen, sem header)
  // Renderizar diretamente sem passar pelo layout com Header
  if (location.pathname === "/kitchen") {
    return (
      <Routes>
        <Route
          path="/kitchen"
          element={
            <ProtectedRoutes>
              <Kitchen />
            </ProtectedRoutes>
          }
        />
      </Routes>
    );
  }

  return (
    <>
      {!hideHeaderRoutes.includes(location.pathname) && <Header />}
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoutes>
              <Home />
            </ProtectedRoutes>
          }
        />
        <Route path="/auth" element={isAuth ? <Navigate to="/" /> : <Auth />} />
        <Route
          path="/orders"
          element={
            <ProtectedRoutes>
              <Orders />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/tables"
          element={
            <ProtectedRoutes>
              <Tables />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/menu"
          element={
            <ProtectedRoutes>
              <Menu />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoutes>
              <Dashboard />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/table/:id/bill"
          element={
            <ProtectedRoutes>
              <TableBill />
            </ProtectedRoutes>
          }
        />
        <Route
          path="/commissions"
          element={
            <ProtectedRoutes>
              <Commissions />
            </ProtectedRoutes>
          }
        />
        <Route path="*" element={<div>Not Found</div>} />
      </Routes>
    </>
  );
}

function ProtectedRoutes({ children }) {
  const { isAuth } = useSelector((state) => state.user);
  if (!isAuth) {
    return <Navigate to="/auth" />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <Layout />
    </Router>
  );
}

export default App;
