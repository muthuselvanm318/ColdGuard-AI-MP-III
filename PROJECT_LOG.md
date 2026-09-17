# ColdGuard AI — Project Log & Presentation Notes

This document tracks the modifications made to the project during development and highlights the key technologies and modules used. You can use this content directly for your **Project Review** and **PPT Presentation**.

---

## 🏗️ Important Modules & Technologies Used

When presenting your architecture, highlight these core technologies:

| Technology / Module | Purpose in Project |
|---------------------|--------------------|
| **React 18** | Core frontend framework used to build the interactive, component-based user interface. |
| **Vite** | Next-generation build tool providing ultra-fast hot module replacement (HMR) and optimized production builds. |
| **Recharts** | Composable charting library built on React components, used for rendering real-time temperature data area charts. |
| **React Router v6** | Handles client-side navigation between the Dashboard, Devices, Products, Analytics, and Alerts pages without reloading the browser. |
| **Vanilla CSS (Custom Properties)** | A highly customized CSS design system using variables (`--var`) for theme management, eliminating the need for heavy external styling libraries. |
| **Lucide React** | Lightweight, clean SVG icon library used across the dashboard for visual indicators. |
| **React Context API** | Global state management (`DataContext.jsx`) that holds live device data, product inventories, and system alerts without prop-drilling. |
| **Mock IoT Simulator** | Custom logic (`mockData.js`, `deviceService.js`) running a `setInterval` loop to generate realistic, fluctuating time-series temperature data and auto-trigger breach alerts. |
| **ML Hook (`usePrediction`)** | A custom React hook designed to intercept live temperature data, extract 10 specific features, and pass them to a prediction service for safety scoring. |

---

## 📝 Modification & Update Log

### [Update 2] UI Overhaul: iOS 15 Glassmorphism & Bubble Aesthetic
*Date: July 17, 2026*

**Changes Made:**
- **Background Restyling:** Replaced static mesh with dynamically animated, heavily blurred color blobs (iOS standard blue/indigo) to enhance the glass effect.
- **Frosted Glass Cards:** Increased `backdrop-filter: blur(40px)` on all cards and modals. Added translucent white borders to simulate glass edge reflections.
- **Bubble Buttons:** Redesigned buttons to a pill shape (`border-radius: 9999px`) utilizing linear gradients and inset box-shadows to create a glossy, 3D bubble effect.
- **Color Palette Update:** Adjusted status colors to match Apple's native Human Interface Guidelines (System Blue, System Green, System Yellow, System Red).
- **Modals:** Updated `AddDeviceModal` and `AddProductModal` to resemble iOS Action Sheets with high blur and rounded corners.

### [Update 1] Initial Build: ColdGuard AI Dashboard
*Date: July 17, 2026*

**Changes Made:**
- **Project Scaffolding:** Initialized React application via Vite.
- **Page Creation:** Built 5 core views: `Dashboard`, `Devices`, `Products`, `Analytics`, and `Alerts`.
- **Component Architecture:** Created reusable UI elements including `StatCard`, `SafetyBadge`, `SafetyGauge` (custom SVG), and `TemperatureChart` (Recharts).
- **Data Simulation:** Implemented `deviceService.js` to simulate live data polling every 5 seconds.
- **ML Integration Layer:** Defined a 10-feature input schema for the future Machine Learning model and created `predictionService.js` as a placeholder API hook.
- **Alert System:** Built an automatic alert generator that monitors live temperature streams against defined safe thresholds.