# 🗓️ Leaves Management System

A **Full-Stack Leaves Management System** built using **NestJS, React and AWS services **.
This system helps manage employee leaves, meetings, and events with a modern and user-friendly interface.

---

# 🚀 Tech Stack

### Server

* NestJS
* JWT Authentication
* AWS DynamoDB
* AWS API Gateway
* AWS Lambda

### Client

* React
* Vite
* TypeScript
* Tailwind CSS
* Lucide Icons
* AWS CloudFront
* AWS S3

---

# 📂 Project Structure

```
leave-management/
│
├── client/
│   ├── node_modules/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── employee/
│   │   │   └── leave/
│   │   ├── services/
│   │   ├── types/
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   │
│   ├── .gitignore
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.app.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
│
├── infrastructure/
│   ├── api/
│   ├── dynamodb/
│   ├── iam/
│   ├── s3/
│   └── outputs.yml
│
├── scripts/
│
├── server/
│   ├── src/
│   │   │
│   │   ├── common/                  # Reusable shared code
│   │   │   ├── decorators/
│   │   │   ├── filters/
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   └── utils/
│   │   │
│   │   ├── config/                  # Env & config setup
│   │   │
│   │   ├── dynamo/                  # DynamoDB logic (if used)
│   │   │
│   │   ├── modules/                 # All business modules
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── employees/
│   │   │   ├── attendance/
│   │   │   ├── leaves/
│   │   │   ├── leave-types/
│   │   │   ├── officetime/
│   │   │   ├── holidays/
│   │   │   └── payroll/
│   │   │
│   │   ├── lambdas/                 # Serverless entry points
│   │   │   ├── auth.lambda.ts
│   │   │   ├── users.lambda.ts
│   │   │   ├── employees.lambda.ts
│   │   │   ├── attendance.lambda.ts
│   │   │   ├── leaves.lambda.ts
│   │   │   ├── leave-types.lambda.ts
│   │   │   ├── officetime.lambda.ts
│   │   │   ├── holidays.lambda.ts
│   │   │   └── payroll.lambda.ts
│   │   │
│   │   ├── app.module.ts
│   │   ├── app.controller.ts
│   │   ├── app.service.ts
│   │   └── main.ts
│   ├── .env
│   ├── serverless.yml
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.build.json
│
└── README.md
```

---

# ⚙️ Installation

## 1️⃣ Clone Repository

```
git clone https://github.com/pragneysh/Leave-Management.git
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
JWT_SECRET="your_secret_key"
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

# ✨ Features

* Employee Leave Management
* Calendar View (Leaves)
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

# 🚀 Deployment

This project uses a deployment script for automated infrastructure and application deployment.

### Run Deployment Script

```bash
./scripts/deploy.sh
```

### Make Script Executable (First Time Only)

```bash
chmod +x ./scripts/deploy.sh
chmod +x ./scripts/deploy-server.sh
chmod +x ./scripts/deploy-client.sh
```

This script will:

- Deploy AWS infrastructure
- Deploy NestJS Lambda services
- Build and deploy React client to AWS S3
- Configure CloudFront distribution
- Update required outputs

---


---

# 👨‍💻 Author

**Pragneysh Dekate**

GitHub
https://github.com/pragneyah

---

# 📄 License

MIT License
test auto build
