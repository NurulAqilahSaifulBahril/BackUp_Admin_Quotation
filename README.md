# Eternalgy Admin System (ee-admin-v5)

A comprehensive internal administration and management dashboard built to manage customers, generate and track invoices/quotations, and manage agents, departments, and commissions.

## 🚀 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19)
- **Database ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Database**: PostgreSQL
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Deployment Configured for**: Docker, Railway, Nixpacks

## 📂 Project Structure

- `/src/app/(app)`: Contains all the protected dashboard routes (Customers, Invoices, Payments, Engineering, etc.)
- `/src/components`: Reusable React components (Layouts, Modals, InvoiceEditor)
- `/src/db`: Drizzle ORM schema definitions and database connection setup (`schema.ts`)
- `/src/lib`: Core utility functions, template renderers (like `quotation-template.ts` and `invoice-renderer.ts`), and constants
- `/docs`: Project documentation, architectural guides, and feature trackers
- `/scripts`: Utility scripts for syncing data, calculating commissions, and inspecting the database

## 🛠️ Getting Started Locally

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL database running locally or remotely

### 2. Environment Variables
Create a `.env` file in the root directory (you can copy `.env.example` as a template) and configure your database URL:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/your_database"
```

### 3. Installation
Install the required dependencies:
```bash
npm install
```

### 4. Running the Development Server
Start the Next.js development server. It runs on port **4425** by default:
```bash
npm run dev
```
Open [http://localhost:4425](http://localhost:4425) in your browser to view the application.

## 📦 Key Scripts

- `npm run dev`: Starts the development server on port 4425.
- `npm run build`: Compiles the Next.js application for production.
- `npm run calc-comm`: Runs the commission calculation script.

## 🏗️ Deployment

This project contains configuration files for several deployment environments:
- `docker-compose.yml` and `.dockerignore` for Docker environments.
- `railway.json` and `nixpacks.toml` for Railway deployment optimizations.
