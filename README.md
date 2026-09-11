# ColdGuard AI - Refrigerated Food Safety & Shelf-Life Monitoring

ColdGuard AI is an Internet of Things (IoT) based food safety monitoring dashboard designed to track and manage refrigerated food products. It serves as an MVP (Minimum Viable Product) intended for a student project/presentation, demonstrating how sensor data can be visualized to ensure food safety and estimate remaining shelf life. 

> **Note:** To keep the project scope focused and achievable for an MVP, **temperature** is the ONLY environmental parameter monitored in this system.

## 🚀 Project Overview

Food spoilage due to improper refrigeration is a major issue in the supply chain. ColdGuard AI provides a centralized dashboard to monitor the temperature of storage units in real-time. By tracking the temperature exposure of specific products (like Fresh Milk), the system determines the current food safety status and dynamically calculates the estimated remaining shelf life.

### Key Features
- **Real-Time Monitoring:** View live temperature readings from simulated IoT sensors (e.g., ESP32 nodes).
- **Product Tracking:** Register specific food products, assign them to a temperature sensor, and monitor their safety status.
- **Dynamic Shelf-Life Estimation:** The system warns users if the product has been exposed to unsafe temperatures, which would degrade its shelf life.
- **Data Visualization:** Line charts displaying 24-hour temperature history and safe-range thresholds.
- **System Alerts:** Notification system for temperature breaches (Warning/Critical).
- **Comprehensive Reporting:** Exportable summaries of device status and product safety.
- **Glassmorphism UI:** A modern, clean, and responsive user interface designed specifically for a professional food-tech/IoT application.

---

## 🛠️ Technology Stack

This project was built using modern web development tools and completely decoupled from a backend to run entirely as a client-side application for easy demonstration.

### Frontend Technologies
1. **React.js (v18):** The core JavaScript library used for building the user interface using a component-based architecture.
2. **Vite:** A blazing fast frontend build tool and development server.
3. **React Router (v6):** Used for seamless Single Page Application (SPA) navigation between pages (Dashboard, Products, Alerts, Settings, etc.) without reloading the browser.
4. **Context API:** React's built-in state management feature (`DataContext.jsx`) is used to manage global state (mock databases for products, devices, and alerts) across the entire application.
5. **Recharts:** A composable charting library built on React components used to render the "Temperature History" line charts.
6. **Lucide React:** A beautiful and consistent icon library used throughout the dashboard.
7. **Vanilla CSS (CSS3):** The entire application is styled using pure CSS, utilizing custom properties (variables) for a consistent design system, Flexbox/Grid for layout, and modern glassmorphism techniques (blur and transparency) for a premium aesthetic. 

### Architecture (Decoupled Client-Side MVP)
For the purpose of this MVP presentation, the application is intentionally decoupled from a live backend database. All data operations (Adding Products, Acknowledging Alerts, Reading Sensor Data) are handled through **React State** mimicking a real database. This allows for a completely standalone, robust demonstration without the risk of server downtime or complex database setup during a Viva presentation.

---

## 📂 Project Structure

```text
MP-III/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable UI elements
│   │   ├── AddProductModal.jsx # Form to register a new product
│   │   ├── ProductCard.jsx     # Modern card displaying product summary
│   │   ├── Header.jsx          # Top navigation bar
│   │   └── Sidebar.jsx         # Left-side navigation menu
│   ├── context/
│   │   └── DataContext.jsx     # Global state & mock data store (Core Logic)
│   ├── pages/              # Main application views
│   │   ├── Dashboard.jsx       # High-level overview
│   │   ├── Products.jsx        # List of all monitored food items
│   │   ├── ProductDetails.jsx  # In-depth analytics and charts for a single product
│   │   ├── Devices.jsx         # IoT Sensor management
│   │   ├── Alerts.jsx          # System notifications
│   │   ├── Reports.jsx         # Data export and summaries
│   │   └── Settings.jsx        # App configuration
│   ├── App.jsx             # Root component & Route definitions
│   ├── index.css           # Global design system & styling
│   └── main.jsx            # Application entry point
├── index.html              # HTML template
├── package.json            # Project dependencies
└── vite.config.js          # Vite build configuration
```

---

## 💻 How to Run the Project Locally

Because the project is a standalone React SPA, running it is incredibly simple. You only need Node.js installed on your machine.

1. **Open your terminal** and navigate to the project folder:
   ```bash
   cd path/to/MP-III
   ```
2. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```
3. **Start the development server:**
   ```bash
   npm run dev
   ```
4. **View the Dashboard:** Open the URL provided in the terminal (usually `http://localhost:5173`) in your web browser.

---

## 🎓 Viva/Presentation Talking Points

If you are presenting this project for an academic evaluation, here are some recommended talking points:

1. **Problem Statement:** Emphasize that improper temperature control is a leading cause of food waste. ColdGuard AI solves this by ensuring visibility over the cold chain.
2. **Design Philosophy:** Highlight the UI. Mention that you chose a "Glassmorphism" aesthetic with a clean white/green/blue theme to convey cleanliness, technology, and food safety.
3. **IoT Simulation:** Explain that while this is a software dashboard, it is built to interface directly with hardware like an `ESP32 Temperature Node`. In this MVP, the sensor's data streams are mocked via the React Context API.
4. **Scalability:** The architecture (React + Context) means that attaching this to a real backend (like Node.js or PHP) later simply involves replacing the local state functions in `DataContext.jsx` with real `fetch()` or API calls, without needing to rewrite any UI components. 
