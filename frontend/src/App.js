import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/navbar'; 
import SmartResumeEditor from './components/SmartResumeEditor';
import Hero from './components/Hero';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import Testimonials from './components/Testimonials';
import Auth from './components/Auth';
import Footer from './components/Footer';
import ResumeUploadPage from './components/ResumeUpload';
import Login from './components/Login';
import Register from './components/Register';
import ChatAssistant from './components/ChatAssistant';
import Profile from './components/profile';

<Route path="/editor" element={<SmartResumeEditor />} />

function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Auth />
    </>
  );
}

function App() {
  return (
    <Router>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/upload" element={<ResumeUploadPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/smart-editor" element={<SmartResumeEditor />} />
          <Route path="/chat-assistant" element={<ChatAssistant />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>
      <Footer />
    </Router>
  );
}

export default App;
