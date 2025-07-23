# 💼 TellerMade — Frontend

TellerMade is an AI-powered resume tailoring platform that helps job seekers customize their resumes to match specific job descriptions, optimize for Applicant Tracking Systems (ATS), and improve interview conversion rates.

This repository contains the **frontend** of TellerMade, built using **React**, **Vite**, and **Tailwind CSS**.

---

## 🚀 Live Preview

> Coming soon...

---

## 🧰 Tech Stack

* ⚛️ React – Component-based UI library
* ⚡ Vite – Lightning-fast bundler and dev server
* 🎨 Tailwind CSS – Utility-first CSS framework
* 📦 Axios – HTTP client (for backend integration)

---

## 📁 Project Structure

```
frontend/
├── public/                # Static assets
├── src/                   # App source code
│   ├── assets/            # Images, logos, etc.
│   ├── components/        # Reusable UI components
│   ├── pages/             # Top-level views/pages
│   ├── services/          # API requests (Axios)
│   ├── App.jsx            # Root component
│   └── main.jsx           # Entry point
├── tailwind.config.js     # Tailwind CSS configuration
├── postcss.config.js      # PostCSS plugins
├── package.json           # Project metadata and dependencies
└── vite.config.js         # Vite configuration
```

---

## 🛠️ Local Development Setup

### 1. Clone the Repository

```
git clone https://github.com/WorkedUpShoury/teller-made.git
cd teller-made/frontend
```

### 2. Install Dependencies

```
npm install
```

### 3. Run the Dev Server

```
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⚙️ Environment Variables

If your app uses environment variables, copy the example and customize:

```
cp .env.example .env
```

### `.env.example`

```
VITE_API_URL=http://localhost:5000/api
```

---

## 🧪 Testing (Coming Soon)

Unit and integration testing setup will be added with Vitest or Jest.

---

## 👥 Contributing

1. Fork the repository
2. Create a new branch: `git checkout -b feature/your-feature-name`
3. Make your changes and commit: `git commit -m 'feat: your message'`
4. Push to your fork: `git push origin feature/your-feature-name`
5. Submit a Pull Request

---

## 📄 License

This project is licensed under the [MIT License](../LICENSE).
