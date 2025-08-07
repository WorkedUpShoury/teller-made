import React, { useState } from 'react';
import { Navbar, Container, Nav, Button } from 'react-bootstrap';
import { FaHome, FaFileAlt, FaCheckCircle, FaSignInAlt } from 'react-icons/fa';
import Auth from './Auth';

const Header = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);

  const scrollToSection = (sectionId) => {
    if (sectionId === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <>
      <Navbar bg="white" expand="lg" className="py-2 custom-navbar sticky-top">
        <Container>
          <Navbar.Brand 
            href="#home" 
            className="fw-bold fs-4" 
            style={{ color: '#5d3c8b', cursor: 'pointer' }}
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('home');
            }}
          >
            TellerMade
          </Navbar.Brand>
          
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          
          <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
            <Nav className="align-items-center gap-2">
              <Nav.Link 
                href="#home" 
                className="nav-link-item"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('home');
                }}
              >
                <FaHome className="nav-icon" /> Home
              </Nav.Link>
              
              <Nav.Link 
                href="#features" 
                className="nav-link-item"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('features');
                }}
              >
                <FaFileAlt className="nav-icon" /> Resume
              </Nav.Link>
              
              <Nav.Link 
                href="#how-it-works" 
                className="nav-link-item"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('features');
                }}
              >
                <FaCheckCircle className="nav-icon" /> ATS Check
              </Nav.Link>
              
              <Button 
                variant="outline-primary" 
                className="ms-3"
                onClick={() => setShowAuthModal(true)}
              >
                <FaSignInAlt className="me-2" /> Login
              </Button>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Auth 
        show={showAuthModal} 
        handleClose={() => setShowAuthModal(false)} 
      />
    </>
  );
};

export default Header;