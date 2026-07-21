# 🍽️ **Restaurant POS System**  

A full-featured **Restaurant POS System** built using the **MERN Stack** to streamline restaurant operations, enhance customer experience, and manage orders, payments, and inventory with ease.

## 📚 **Documentação**

**Documentação técnica completa e verificável disponível em:**

- 📖 **[DOCUMENTACAO_TECNICA.md](./DOCUMENTACAO_TECNICA.md)** - Documentação técnica principal (48KB)
- 🗂️ **[INDICE_DOCUMENTACAO.md](./INDICE_DOCUMENTACAO.md)** - Índice mestre de toda documentação

**A documentação permite que qualquer engenheiro sênior compreenda, depure, estenda, valide, opere e evolua o projeto sem depender do autor original.**

---

## ✨ **Features**

- 🍽️ **Order Management**  
  Efficiently manage customer orders with real-time updates and status tracking.

- 🪑 **Table Reservations**  
  Simplify table bookings and manage reservations directly from the POS.

- 🔐 **Authentication**  
  Secure login and role-based access control for admins, staff, and users.

- 💸 **Payment Integration**  
  Integrated with **Razorpay** (or other gateways) for seamless online payments.

- 🧾 **Billing & Invoicing**  
  Automatically generate detailed bills and invoices for every order.

- 🏪 **Multi-store Support**  
  Manage multiple restaurant locations from a single system.

- 👨‍🍳 **Kitchen Display System (KDS)**  
  Real-time order tracking for kitchen staff.

- 💰 **Cash Management**  
  Complete cash register management with opening/closing sessions.

- 📊 **Reports & Analytics**  
  Detailed sales reports and business insights.


## 🏗️ **Tech Stack**

| **Category**             | **Technology**                |
|--------------------------|-------------------------------|
| 🖥️ **Frontend**          | React.js, Redux, Tailwind CSS  |
| 🔙 **Backend**           | Node.js, Express.js           |
| 🗄️ **Database**          | MongoDB                       |
| 🔐 **Authentication**    | JWT, bcrypt                   |
| 💳 **Payment Integration**| Razorpay    |
| 📊 **State Management**   | Redux Toolkit                 |
| ⚡ **Data Fetching & Caching** | React Query            |
| 🔗 **APIs**              | RESTful APIs                   |
| 🔌 **Real-time**         | Socket.io                     |

---
<br>

## 🚀 **Quick Start**

### Prerequisites

- Node.js 18+
- MongoDB 6.0+ (com replica set para transações)
- npm ou yarn

### Installation

```bash
# Clone o repositório
git clone <repository-url>
cd Restaurant_POS_System

# Instale dependências do backend
cd pos-backend
npm install
cp .env.example .env

# Instale dependências do frontend
cd ../pos-frontend
npm install
cp .env.example .env
```

### Configuration

**Backend (.env)**:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/restaurant_pos
JWT_SECRET=seu-segredo-aqui
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:5173
```

**Frontend (.env)**:
```env
VITE_API_URL=http://localhost:5000
```

### Running the Application

```bash
# Terminal 1 - Backend
cd pos-backend
npm run dev

# Terminal 2 - Frontend
cd pos-frontend
npm run dev
```

Acesse: `http://localhost:5173`

**Credenciais padrão**:
- Email: `admin@restaurant.com`
- Senha: `admin123`

---

## 📺 **YouTube Playlist**

🎬 Follow the complete tutorial series on building this Restaurant POS System on YouTube:  
👉 [Watch the Playlist](https://www.youtube.com/playlist?list=PL9OdiypqS7Nk0DHnSNFIi8RgEFJCIWB6X)  

## 📁 **Assets**

- 📦 **Project Assets:** [Google Drive](https://drive.google.com/drive/folders/193N-F1jpzyfPCRCLc9wCyaxjYu2K6PC_)

---

## 📋 **Flow Chart for Project Structure**

- 🗺️ **Visualize the Project Structure:** [View Flow Chart](https://app.eraser.io/workspace/IcU1b6EHu9ZyS9JKi0aY?origin=share)

---

## 🎨 **Design Inspiration**

- 💡 **UI/UX Design Reference:** [Behance Design](https://www.behance.net/gallery/210280099/Restaurant-POS-System-Point-of-Sale-UIUX-Design)

---

## 🖼️ **Project Screenshots**

<table>
  <tr>
    <td><img src="https://res.cloudinary.com/amritrajmaurya/image/upload/v1740502772/ibjxvy5o1ikbsdebrjky.png" alt="Screenshot 1" width="300"/></td>
    <td><img src="https://res.cloudinary.com/amritrajmaurya/image/upload/v1740502773/ietao6dnw6yjsh4f71zn.png" alt="Screenshot 2" width="300"/></td>
  </tr>
  <tr>
    <td><img src="https://res.cloudinary.com/amritrajmaurya/image/upload/v1740502772/vesokdfpa1jb7ytm9abi.png" alt="Screenshot 3" width="300"/></td>
    <td><img src="https://res.cloudinary.com/amritrajmaurya/image/upload/v1740502772/setoqzhzbwbp9udpri1f.png" alt="Screenshot 4" width="300"/></td>
  </tr>
  <tr>
    <td><img src="https://res.cloudinary.com/amritrajmaurya/image/upload/v1740502772/fc4tiwzdoisqwac1j01y.png" alt="Screenshot 5" width="300"/></td>
  </tr>
</table>


✨ Feel free to explore, contribute, and enhance the project! 🚀

💡 To contribute, please check out the **CONTRIBUTING.md** for guidelines.

⭐ If you find this project helpful, don't forget to **star** the repository! 🌟

---

## 📖 **Documentação Técnica**

Para documentação técnica completa, incluindo:
- Arquitetura do sistema
- Modelos de dados
- API endpoints
- WebSocket events
- Padrões de código
- Troubleshooting
- Guia de operação e deploy

**Consulte:**
- 📖 [DOCUMENTACAO_TECNICA.md](./DOCUMENTACAO_TECNICA.md) - Documentação principal
- 🗂️ [INDICE_DOCUMENTACAO.md](./INDICE_DOCUMENTACAO.md) - Índice de toda documentação

---

## 🌍 **Implementações Regionais**

- 🇧🇷 [IMPLEMENTACAO_BRASIL.md](./IMPLEMENTACAO_BRASIL.md) - Funcionalidades para o mercado brasileiro

---

## 📝 **Changelog**

- 📋 [CHANGELOG.md](./CHANGELOG.md) - Histórico de mudanças

---

## 🔒 **Security**

- 🔐 [SECURITY.md](./SECURITY.md) - Políticas de segurança
