import { useEffect } from "react";
import restaurant from "../assets/images/restaurant-img.jpg"
import logo from "../assets/images/logo.png"
import Login from "../components/auth/Login";

const Auth = () => {

  useEffect(() => {
    document.title = "POS | Autenticação"
  }, [])

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      {/* Left Section - Brand/Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center bg-cover">
        {/* BG Image */}
        <img className="w-full h-full object-cover" src={restaurant} alt="Imagem do Restaurante" />

        {/* Black Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-80"></div>

        {/* Quote at bottom */}
        <blockquote className="absolute bottom-10 px-8 mb-10 text-2xl italic text-white">
          &ldquo;Sirva os clientes com a melhor comida, atendimento rápido e amigável em um ambiente acolhedor, e eles sempre voltarão.&rdquo;
          <br />
          <span className="block mt-4 text-yellow-400">- Fundador do Restro</span>
        </blockquote>
      </div>

      {/* Right Section - Form */}
      <div className="w-full lg:w-1/2 min-h-screen bg-[#1a1a1a] p-6 sm:p-10 flex flex-col justify-center">
        <div className="flex flex-col items-center gap-2">
          <img src={logo} alt="Logo Restro" className="h-14 w-14 border-2 rounded-full p-1" />
          <h1 className="text-lg font-semibold text-[#f5f5f5] tracking-wide">Restro</h1>
        </div>

        <h2 className="text-3xl sm:text-4xl text-center mt-8 sm:mt-10 font-semibold text-yellow-400 mb-8 sm:mb-10">
          Login do Funcionário
        </h2>

        {/* Components */}
        <Login />

      </div>
    </div>
  );
};

export default Auth;
