# 🗓️ Leaves Management System

A **Full-Stack Leaves Management System** built using **NestJS, React, Prisma ORM, and MySQL**.
This system helps manage employee leaves, meetings, and events with a modern and user-friendly interface.

---

# 🚀 Tech Stack

### Server

* NestJS
* Prisma ORM
* MySQL (AWS RDS)
* JWT Authentication
* REST API

### Client

* React
* Vite
* TypeScript
* Tailwind CSS
* Lucide Icons

---

# 📂 Project Structure

```
leaves-management-system
│
├── client
│   ├── src
│   │   ├── components
│   │   ├── pages
│   │   ├── services
│   │   ├── hooks
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
├── server
│   ├── src
│   │   ├── auth
│   │   ├── employees
│   │   ├── leaves
│   │   ├── calendar
│   │   └── main.ts
│   │
│   ├── prisma
│   │   └── schema.prisma
│   │
│   └── package.json
│
└── README.md
```

---

# ⚙️ Installation

## 1️⃣ Clone Repository

```
git clone https://github.com/your-username/leaves-management-system.git
cd leaves-management-system
```

---

# 🖥 Server Setup (NestJS)

```
cd server
npm install
```

Create `.env`

```
DATABASE_URL="mysql://username:password@localhost:3306/leaves_db"
JWT_SECRET="your_secret_key"
```

Install Prisma (v5)

```
npm install prisma@5 --save-dev
npm install @prisma/client@5
```

Run Prisma migration

```
npx prisma migrate dev
```

Generate Prisma client

```
npx prisma generate
```

Start server

```
npm run start:dev
```

Server will run on:

```
http://localhost:3000
```

---

# 💻 Client Setup (React)

```
cd client
npm install
npm run dev
```

Client will run on:

```
http://localhost:5173
```

---

# 🗄 Database (Prisma)

Open Prisma Studio

```
npx prisma studio
```

---

# ✨ Features

* Employee Leave Management
* Calendar View (Leaves, Meetings, Events)
* Add / Edit / Delete Leaves
* Employee Management
* JWT Authentication
* RESTful API
* Responsive UI

---

# 🐛 Common Issues

### CORS Issue (NestJS)

Make sure CORS is enabled in `main.ts`

```ts
app.enableCors({
  origin: true,
  credentials: true,
});
```

---

### Prisma Issues

```
npx prisma generate
```

---

# 👨‍💻 Author

**Pragneysh Dekate**

GitHub
https://github.com/pragneyah

---

# 📄 License

MIT License
